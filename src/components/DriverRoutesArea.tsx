import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Route, RouteStop, StopStatus } from '../types';
import { 
  Play, 
  MapPin, 
  Package, 
  CheckCircle2, 
  Navigation, 
  Clock, 
  FileText,
  Truck
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export function DriverRoutesArea() {
  const { user } = useAuth();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'routes'), 
      where('driverId', '==', user.uid),
      where('status', 'in', ['dispatching', 'in_transit'])
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const routesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Route));
      setRoutes(routesData);
      
      // Auto-select in_transit route if available
      const inTransit = routesData.find(r => r.status === 'in_transit');
      if (inTransit) {
        setActiveRoute(inTransit);
      } else if (routesData.length > 0 && !activeRoute) {
        setActiveRoute(routesData[0]);
      }
      setLoading(false);
    });

    return unsub;
  }, [user]);

  const updateStopStatus = async (routeId: string, stopIndex: number, status: StopStatus) => {
    if (!activeRoute) return;

    const newStops = [...activeRoute.stops];
    const timestamp = new Date().toISOString();

    if (status === 'arrived') newStops[stopIndex].arrivedAt = timestamp;
    if (status === 'loading_unloading') newStops[stopIndex].opStartedAt = timestamp;
    if (status === 'finished_op') newStops[stopIndex].opEndedAt = timestamp;
    if (status === 'departed') newStops[stopIndex].departedAt = timestamp;

    newStops[stopIndex].status = status;

    try {
      await updateDoc(doc(db, 'routes', routeId), {
        stops: newStops,
        // Update route status if this was the first start
        ...(activeRoute.status === 'dispatching' ? { status: 'in_transit', startedAt: timestamp } : {})
      });

      // Log event
      await addDoc(collection(db, `routes/${routeId}/events`), {
        type: status,
        stopId: newStops[stopIndex].id,
        timestamp: serverTimestamp(),
        notes: `Evento ${status} registado pelo motorista.`
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  const completeRoute = async (routeId: string) => {
    try {
      await updateDoc(doc(db, 'routes', routeId), {
        status: 'completed',
        completedAt: new Date().toISOString()
      });
      setActiveRoute(null);
    } catch (error) {
      console.error("Erro ao completar rota:", error);
    }
  };

  if (loading) return <div className="p-8 text-white">A carregar rotas...</div>;

  if (routes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-6">
          <Truck className="w-10 h-10 text-slate-700" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Sem Rotas Ativas</h2>
        <p className="text-slate-500 max-w-xs">Não tem rotas atribuídas no momento. Aguarde o despacho da sua central.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">As Minhas Rotas</h1>
          <p className="text-slate-500">Gestão de entregas e serviços em tempo real</p>
        </div>
      </div>

      {activeRoute && (
        <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
          <div className="p-6 bg-indigo-600/10 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-600 rounded-2xl">
                <Navigation className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white leading-none mb-1">Rota Ativa</h2>
                <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">
                  {activeRoute.vehicleName} • {activeRoute.stops.length} Clientes
                </p>
              </div>
            </div>
            <div className="px-3 py-1 bg-indigo-600/20 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/30">
              {activeRoute.status === 'in_transit' ? 'Em Trânsito' : 'Aguardando Início'}
            </div>
          </div>

          <div className="p-6 space-y-8">
            {activeRoute.stops.map((stop, index) => {
              const isCompleted = stop.status === 'departed';
              const isCurrent = !isCompleted && (index === 0 || activeRoute.stops[index-1].status === 'departed');

              return (
                <div key={stop.id} className={`relative flex gap-6 ${!isCurrent && !isCompleted ? 'opacity-40' : ''}`}>
                  {/* Timeline connector */}
                  {index < activeRoute.stops.length - 1 && (
                    <div className="absolute left-6 top-12 bottom-[-32px] w-0.5 bg-slate-800" />
                  )}

                  <div className={`z-10 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border-2 transition-all ${
                    isCompleted ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' :
                    isCurrent ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 ring-4 ring-indigo-600/10' :
                    'bg-slate-800 border-slate-700 text-slate-500'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <span className="font-bold">{index + 1}</span>}
                  </div>

                  <div className="flex-1">
                    <div className="mb-4">
                      <h3 className={`text-lg font-bold ${isCompleted ? 'text-slate-400 line-through' : 'text-white'}`}>{stop.name}</h3>
                      <p className="text-slate-500 text-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {stop.address}
                      </p>
                    </div>

                    {isCurrent && (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        <StatusButton 
                          active={stop.status === 'arrived'}
                          completed={!!stop.arrivedAt}
                          onClick={() => updateStopStatus(activeRoute.id, index, 'arrived')}
                          icon={<MapPin className="w-4 h-4" />}
                          label="Chegada"
                        />
                        <StatusButton 
                          active={stop.status === 'loading_unloading'}
                          completed={!!stop.opStartedAt}
                          disabled={!stop.arrivedAt}
                          onClick={() => updateStopStatus(activeRoute.id, index, 'loading_unloading')}
                          icon={<Play className="w-4 h-4" />}
                          label="Iniciar Op."
                        />
                        <StatusButton 
                          active={stop.status === 'finished_op'}
                          completed={!!stop.opEndedAt}
                          disabled={!stop.opStartedAt}
                          onClick={() => updateStopStatus(activeRoute.id, index, 'finished_op')}
                          icon={<CheckCircle2 className="w-4 h-4" />}
                          label="Fim Op."
                        />
                        <StatusButton 
                          active={stop.status === 'departed'}
                          completed={!!stop.departedAt}
                          disabled={!stop.opEndedAt}
                          onClick={() => updateStopStatus(activeRoute.id, index, 'departed')}
                          icon={<Truck className="w-4 h-4" />}
                          label="Saída"
                        />
                      </div>
                    )}

                    {isCompleted && (
                      <div className="flex gap-4 mt-2">
                        <div className="text-[10px] text-slate-600">
                          <span className="font-bold">TOTAL:</span> {stop.departedAt && stop.arrivedAt ? 
                            Math.round((new Date(stop.departedAt).getTime() - new Date(stop.arrivedAt).getTime()) / 60000) : 0} min
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {activeRoute.stops.every(s => s.status === 'departed') && (
              <div className="pt-8 border-t border-slate-800">
                <button 
                  onClick={() => completeRoute(activeRoute.id)}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs"
                >
                  Finalizar Tudo e Submeter Relatório
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusButton({ active, completed, disabled, onClick, icon, label }: any) {
  return (
    <button
      disabled={disabled || (completed && !active)}
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
        active ? 'bg-indigo-600 border-indigo-400 text-white' :
        completed ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-500 cursor-default' :
        disabled ? 'bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed' :
        'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
      }`}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}
