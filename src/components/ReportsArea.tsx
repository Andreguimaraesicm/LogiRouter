import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Truck, Clock, MapPin, CheckCircle2, History, User, Euro } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Route, UserProfile } from '../types';
import { useAuth } from '../lib/AuthContext';
import { formatDistance, formatDuration, formatCurrency } from '../lib/formatters';

export function ReportsArea() {
  const { profile } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.companyId) return;

    const q = query(
      collection(db, 'routes'),
      where('companyId', '==', profile.companyId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setRoutes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Route)));
      setLoading(false);
    });

    return unsub;
  }, [profile]);

  const downloadRouteReport = (route: Route) => {
    const headers = ['Operação', 'Paragem', 'Data/Hora', 'Estado'];
    const rows = route.stops.map(stop => [
      stop.name,
      stop.address,
      stop.arrivedAt ? new Date(stop.arrivedAt).toLocaleString() : 'Pendente',
      stop.status
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_rota_${route.id.slice(0, 5)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-8 text-slate-500">A processar dados...</div>;

  const totalDistance = routes.reduce((acc, r) => acc + (r.totalDistance || 0), 0);
  const totalTolls = routes.reduce((acc, r) => acc + (r.totalTolls || 0), 0);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Centro de Relatórios</h2>
          <p className="text-slate-500">Métricas operacionais e registo de eventos logísticos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 shadow-2xl border border-slate-800 p-8 rounded-[2rem] group hover:border-indigo-500/30 transition-all">
          <FileText className="w-8 h-8 text-indigo-500 mb-6 group-hover:scale-110 transition-transform" />
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Km em Serviço</p>
          <h4 className="text-3xl font-black text-white">{formatDistance(totalDistance)}</h4>
        </div>
        <div className="bg-slate-900 shadow-2xl border border-slate-800 p-8 rounded-[2rem] group hover:border-emerald-500/30 transition-all">
          <Euro className="w-8 h-8 text-emerald-500 mb-6 group-hover:scale-110 transition-transform" />
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Estimativa de Custos (Portagens)</p>
          <h4 className="text-3xl font-black text-white">{formatCurrency(totalTolls)}</h4>
        </div>
        <div className="bg-slate-900 shadow-2xl border border-slate-800 p-8 rounded-[2rem] group hover:border-amber-500/30 transition-all">
          <History className="w-8 h-8 text-amber-500 mb-6 group-hover:scale-110 transition-transform" />
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Rotas Processadas</p>
          <h4 className="text-3xl font-black text-white">{routes.length}</h4>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest ml-1">Histórico de Despachos</h3>
        <div className="grid grid-cols-1 gap-4">
          {routes.map(route => (
            <div key={route.id} className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-6 hover:bg-slate-800/20 transition-all group shadow-xl">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${
                    route.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                    route.status === 'in_transit' ? 'bg-indigo-500/10 text-indigo-500' :
                    'bg-slate-800 text-slate-500'
                  }`}>
                    {route.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">Rota #{route.id.slice(-6).toUpperCase()}</h4>
                    <p className="text-xs text-slate-500 flex items-center gap-2">
                      <Truck className="w-3 h-3" /> {route.vehicleName} • <User className="w-3 h-3 ml-1" /> {route.driverName || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-12">
                   <div className="hidden lg:block">
                     <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Paragens</p>
                     <div className="flex gap-1">
                       {route.stops.map((_, i) => (
                         <div key={i} className={`w-2 h-2 rounded-full ${route.stops[i].status === 'departed' ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                       ))}
                     </div>
                   </div>
                   <div className="text-right">
                     <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Desempenho</p>
                     <p className="text-lg font-bold text-white">{formatDistance(route.totalDistance)}</p>
                   </div>
                   <button 
                     onClick={() => downloadRouteReport(route)}
                     className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-2xl shadow-xl shadow-indigo-900/40 transition-all flex items-center gap-2"
                   >
                     <Download className="w-5 h-5" />
                     <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Relatório</span>
                   </button>
                </div>
              </div>
            </div>
          ))}
          {routes.length === 0 && (
            <div className="py-20 text-center bg-slate-900/30 rounded-[2rem] border border-slate-800 border-dashed">
               <FileText className="w-12 h-12 text-slate-800 mx-auto mb-4" />
               <p className="text-slate-600 uppercase text-xs font-black tracking-widest">Sem registos no histórico</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
