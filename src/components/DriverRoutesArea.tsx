import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { Route, RouteStop, StopStatus } from '../types';
import { 
  Play, 
  MapPin, 
  CheckCircle2, 
  Navigation, 
  Clock, 
  Download,
  History,
  Truck,
  Briefcase
} from 'lucide-react';

export function DriverRoutesArea() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [completedRoutes, setCompletedRoutes] = useState<Route[]>([]);
  const [activeRoute, setActiveRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Load active (dispatching / in_transit) routes
    const qActive = query(
      collection(db, 'routes'), 
      where('driverId', '==', user.uid),
      where('status', 'in', ['dispatching', 'in_transit'])
    );

    const unsubActive = onSnapshot(qActive, (snapshot) => {
      const routesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Route));
      setRoutes(routesData);
      
      const inTransit = routesData.find(r => r.status === 'in_transit');
      if (inTransit) {
        setActiveRoute(inTransit);
      } else if (routesData.length > 0) {
        setActiveRoute(routesData[0]);
      } else {
        setActiveRoute(null);
      }
      setLoading(false);
    });

    // Load completed routes history
    const qHistory = query(
      collection(db, 'routes'),
      where('driverId', '==', user.uid),
      where('status', '==', 'completed')
    );

    const unsubHistory = onSnapshot(qHistory, (snapshot) => {
      const historyData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Route));
      setCompletedRoutes(historyData);
    });

    return () => {
      unsubActive();
      unsubHistory();
    };
  }, [user]);

  const startWork = async (routeId: string) => {
    if (!activeRoute) return;
    const timestamp = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'routes', routeId), {
        status: 'in_transit',
        startedAt: timestamp
      });

      await addDoc(collection(db, `routes/${routeId}/events`), {
        type: 'start_work',
        timestamp: serverTimestamp(),
        notes: `Início do trabalho declarado pelo motorista.`
      });
    } catch (error) {
      console.error("Erro ao iniciar trabalho:", error);
      alert("Erro ao declarar início de trabalho.");
    }
  };

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
        stops: newStops
      });

      // Log event to sub-collection
      await addDoc(collection(db, `routes/${routeId}/events`), {
        type: status,
        stopId: newStops[stopIndex].id,
        timestamp: serverTimestamp(),
        notes: `Evento ${status} registado em ${newStops[stopIndex].name}.`
      });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro ao atualizar progresso da paragem.");
    }
  };

  const completeRoute = async (routeId: string) => {
    try {
      await updateDoc(doc(db, 'routes', routeId), {
        status: 'completed',
        completedAt: new Date().toISOString()
      });
      alert('Rota finalizada com sucesso!');
      setActiveRoute(null);
    } catch (error) {
      console.error("Erro ao completar rota:", error);
      alert("Erro ao finalizar rota.");
    }
  };

  const downloadRouteReport = (route: Route) => {
    const headers = [
      'Empresa/Cliente',
      'Morada',
      'Início do Trabalho (Rota)',
      'Chegada ao Cliente',
      'Início Carga/Descarga',
      'Fim Carga/Descarga',
      'Saída do Cliente',
      'Duração Total no Cliente (min)'
    ];

    const rows = route.stops.map(stop => {
      const durationStr = stop.departedAt && stop.arrivedAt
        ? Math.round((new Date(stop.departedAt).getTime() - new Date(stop.arrivedAt).getTime()) / 60000)
        : '0';
        
      return [
        `"${stop.name.replace(/"/g, '""')}"`,
        `"${stop.address.replace(/"/g, '""')}"`,
        route.startedAt ? new Date(route.startedAt).toLocaleString('pt-PT') : 'Não Declarado',
        stop.arrivedAt ? new Date(stop.arrivedAt).toLocaleString('pt-PT') : 'Não Chegou',
        stop.opStartedAt ? new Date(stop.opStartedAt).toLocaleString('pt-PT') : 'Não Iniciado',
        stop.opEndedAt ? new Date(stop.opEndedAt).toLocaleString('pt-PT') : 'Não Finalizado',
        stop.departedAt ? new Date(stop.departedAt).toLocaleString('pt-PT') : 'Não Saiu',
        durationStr
      ];
    });

    // Add Byte Order Mark for Excel UTF-8 and use semi-colon separator
    const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `relatorio_de_rota_${route.id.slice(-6).toUpperCase()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="p-8 text-slate-500">A processar as suas rotas...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight uppercase">Área de Rota</h1>
          <p className="text-slate-500">Gestão e auditoria de serviços em tempo real</p>
        </div>

        {/* Tab Controls */}
        <div className="bg-slate-900 p-1.5 rounded-2xl flex gap-1 border border-slate-800">
          <button
            onClick={() => setActiveTab('current')}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === 'current'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/45'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Em Curso
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/45'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Histórico ({completedRoutes.length})
          </button>
        </div>
      </div>

      {activeTab === 'current' ? (
        <>
          {!activeRoute ? (
            <div className="flex flex-col items-center justify-center p-20 text-center bg-slate-900/30 border border-slate-800 border-dashed rounded-[2.5rem]">
              <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-6">
                <Truck className="w-10 h-10 text-slate-700" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Sem Rotas Ativas</h2>
              <p className="text-slate-500 max-w-xs">Não tem planeamento nem rotas despachadas de momento. Por favor, aguarde.</p>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
              <div className="p-6 bg-slate-850 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl">
                    <Navigation className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white leading-none mb-1">Rota #{activeRoute.id.slice(-6).toUpperCase()}</h2>
                    <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest">
                      {activeRoute.vehicleName} • {activeRoute.stops.length} Paragens
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => downloadRouteReport(activeRoute)}
                    className="flex-1 sm:flex-initial bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Baixar Relatório
                  </button>
                  <div className="px-3.5 py-1.5 bg-indigo-600/15 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/30">
                    {activeRoute.status === 'in_transit' ? 'Em Transito' : 'Aguardando Início'}
                  </div>
                </div>
              </div>

              {activeRoute.status === 'dispatching' ? (
                /* Start Work Gate */
                <div className="p-12 text-center flex flex-col items-center justify-center bg-slate-900">
                  <div className="w-16 h-16 bg-indigo-600/10 text-indigo-400 rounded-full flex items-center justify-center mb-4">
                    <Play className="w-8 h-8 fill-current" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Iniciar Jornada de Trabalho</h3>
                  <p className="text-sm text-slate-500 max-w-md mb-8">
                    Para começar a progredir nos clientes da rota, por favor declare que deu início ao trabalho.
                  </p>
                  <button
                    onClick={() => startWork(activeRoute.id)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-indigo-900/30 transition-all uppercase tracking-widest text-xs flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Dar Início ao Trabalho
                  </button>
                </div>
              ) : (
                /* Actual interactive Stops */
                <div className="p-6 space-y-8 bg-slate-900">
                  {activeRoute.stops.map((stop, index) => {
                    const isCompleted = stop.status === 'departed';
                    const isCurrent = !isCompleted && (index === 0 || activeRoute.stops[index-1].status === 'departed');

                    return (
                      <div key={stop.id} className={`relative flex gap-6 ${!isCurrent && !isCompleted ? 'opacity-30' : ''}`}>
                        {/* Timeline connector */}
                        {index < activeRoute.stops.length - 1 && (
                          <div className="absolute left-6 top-12 bottom-[-40px] w-0.5 bg-slate-800" />
                        )}

                        <div className={`z-10 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border-2 transition-all ${
                          isCompleted ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' :
                          isCurrent ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30 ring-4 ring-indigo-600/10' :
                          'bg-slate-800 border-slate-700 text-slate-500'
                        }`}>
                          {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : <span className="font-bold">{index + 1}</span>}
                        </div>

                        <div className="flex-1 space-y-4">
                          <div>
                            <h3 className={`text-lg font-bold ${isCompleted ? 'text-slate-400 line-through' : 'text-white'}`}>{stop.name}</h3>
                            <p className="text-slate-550 text-sm flex items-center gap-1.5 mt-0.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-500" /> {stop.address}
                            </p>
                          </div>

                          {isCurrent && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/60 shadow-inner">
                              <StatusButton 
                                active={stop.status === 'arrived'}
                                completed={!!stop.arrivedAt}
                                onClick={() => updateStopStatus(activeRoute.id, index, 'arrived')}
                                icon={<MapPin className="w-4 h-4" />}
                                label="Chegada ao Cliente"
                              />
                              <StatusButton 
                                active={stop.status === 'loading_unloading'}
                                completed={!!stop.opStartedAt}
                                disabled={!stop.arrivedAt}
                                onClick={() => updateStopStatus(activeRoute.id, index, 'loading_unloading')}
                                icon={<Play className="w-4 h-4" />}
                                label="Início Carga/Descarga"
                              />
                              <StatusButton 
                                active={stop.status === 'finished_op'}
                                completed={!!stop.opEndedAt}
                                disabled={!stop.opStartedAt}
                                onClick={() => updateStopStatus(activeRoute.id, index, 'finished_op')}
                                icon={<CheckCircle2 className="w-4 h-4" />}
                                label="Fim Carga/Descarga"
                              />
                              <StatusButton 
                                active={stop.status === 'departed'}
                                completed={!!stop.departedAt}
                                disabled={!stop.opEndedAt}
                                onClick={() => updateStopStatus(activeRoute.id, index, 'departed')}
                                icon={<Truck className="w-4 h-4" />}
                                label="Saída do Cliente"
                              />
                            </div>
                          )}

                          {isCompleted && (
                            <div className="flex items-center gap-4 text-xs text-slate-550 mt-1">
                              <span className="bg-emerald-500/10 text-emerald-550 px-2.5 py-1 rounded-md border border-emerald-500/20 font-mono">
                                Executado • {stop.departedAt && stop.arrivedAt ? 
                                  Math.round((new Date(stop.departedAt).getTime() - new Date(stop.arrivedAt).getTime()) / 60000) : 0} min
                              </span>
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
                        Finalizar Tudo e Arquivar Rota
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Completed History views */
        <div className="space-y-4">
          {completedRoutes.map(route => (
            <div key={route.id} className="bg-slate-900/60 border border-slate-800 rounded-[2rem] p-6 hover:bg-slate-800/10 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-emerald-600/15 text-emerald-400 rounded-2xl">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Rota #{route.id.slice(-6).toUpperCase()}</h3>
                  <p className="text-xs text-slate-500">
                    Concluída em {route.completedAt ? new Date(route.completedAt).toLocaleDateString('pt-PT') : 'N/A'} • {route.stops.length} Paragens atendidas
                  </p>
                </div>
              </div>

              <button
                onClick={() => downloadRouteReport(route)}
                className="w-full sm:w-auto bg-slate-850 hover:bg-slate-850 border border-slate-750 text-white font-bold py-3 px-5 rounded-2xl flex items-center justify-center gap-2 transition-all uppercase text-[10px] tracking-widest"
              >
                <Download className="w-4 h-4" />
                Baixar Relatório (CSV)
              </button>
            </div>
          ))}

          {completedRoutes.length === 0 && (
            <div className="py-20 text-center bg-slate-900/30 rounded-[2.5rem] border border-slate-800 border-dashed">
              <History className="w-12 h-12 text-slate-800 mx-auto mb-4" />
              <p className="text-slate-650 uppercase text-xs font-black tracking-widest">Sem rotas no histórico</p>
            </div>
          )}
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
      className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl border transition-all ${
        active ? 'bg-indigo-600 border-indigo-400 text-white shadow-md' :
        completed ? 'bg-emerald-600/15 border-emerald-500/20 text-emerald-400 cursor-default font-semibold' :
        disabled ? 'bg-slate-900/40 border-slate-900/30 text-slate-650 cursor-not-allowed opacity-45' :
        'bg-slate-800/50 border-slate-750 text-slate-400 hover:border-slate-600 hover:text-white'
      }`}
    >
      <div className={completed ? 'text-emerald-400' : 'text-current'}>
        {icon}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-tight text-center leading-tight">{label}</span>
    </button>
  );
}
