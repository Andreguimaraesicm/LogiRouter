import React, { useState, useEffect } from 'react';
import { 
  MapPin, Plus, Trash2, Navigation, Euro, 
  Clock, CheckCircle2, ChevronRight, Loader2, Save, Sparkles, Wand2, Fuel, UserCheck, Truck
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { geocodeAddress, getRoute, estimateTolls } from '../services/routeService';
import { optimizeRoute } from '../services/aiService';
import { formatDuration, formatDistance, formatCurrency } from '../lib/formatters';
import { VEHICLE_TYPES } from '../constants';
import { Vehicle, RouteStop, Route, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/AuthContext';

// Marker fixes
const markerIcon = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const markerShadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface ManagerDashboardProps {
  tollRates: Record<number, number>;
  setActiveTab: (tab: any) => void;
}

export function ManagerDashboard({ tollRates, setActiveTab }: ManagerDashboardProps) {
  const { profile, isMaster } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<UserProfile[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New Route State
  const [newRouteStops, setNewRouteStops] = useState<{address: string, lat?: number, lng?: number}[]>([]);
  const [newStopInput, setNewStopInput] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [calculatedRoute, setCalculatedRoute] = useState<any>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [proposedOrder, setProposedOrder] = useState<number[] | null>(null);

  useEffect(() => {
    if (!profile && !isMaster) return;

    const companyId = profile?.companyId;

    const vQuery = companyId ? query(collection(db, 'vehicles'), where('companyId', '==', companyId)) : collection(db, 'vehicles');
    const unsubVehicles = onSnapshot(vQuery, (snap) => {
      setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
    });

    const dQuery = companyId ? query(collection(db, 'users'), where('companyId', '==', companyId), where('role', '==', 'driver')) : query(collection(db, 'users'), where('role', '==', 'driver'));
    const unsubDrivers = onSnapshot(dQuery, (snap) => {
      setDrivers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });

    const rQuery = companyId ? query(collection(db, 'routes'), where('companyId', '==', companyId), orderBy('date', 'desc')) : query(collection(db, 'routes'), orderBy('date', 'desc'));
    const unsubRoutes = onSnapshot(rQuery, (snap) => {
      setRoutes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Route)));
      setLoading(false);
    });

    return () => { unsubVehicles(); unsubDrivers(); unsubRoutes(); };
  }, [profile, isMaster]);

  const handleAddStop = async () => {
    if (!newStopInput.trim()) return;
    setIsGeocoding(true);
    const result = await geocodeAddress(newStopInput);
    if (result) {
      const newStops = [...newRouteStops, { address: result.display_name, lat: result.lat, lng: result.lng }];
      setNewRouteStops(newStops);
      setNewStopInput('');
      
      if (newStops.length >= 2) {
        const vehicle = vehicles.find(v => v.id === selectedVehicleId);
        const routes = await getRoute(newStops.filter(s => s.lat) as {lat: number, lng: number}[]);
        if (routes && routes[0]) {
          const r = routes[0];
          // Apply truck factor if it's a heavy vehicle
          const truckFactor = vehicle?.type === 'Pesado' ? 1.065 : 1.0;
          setCalculatedRoute({
            ...r,
            distance: r.distance * truckFactor
          });
        } else {
          setCalculatedRoute(null);
        }
      }
    } else {
      alert("Endereço não encontrado.");
    }
    setIsGeocoding(false);
  };

  const handleAIOptimize = async () => {
    if (newRouteStops.length < 3) {
      alert("Adicione pelo menos 3 paragens para otimização por IA.");
      return;
    }
    
    setIsOptimizing(true);
    const vehicle = vehicles.find(v => v.id === selectedVehicleId);
    const vehicleInfo = vehicle ? `${vehicle.type} - ${vehicle.name}` : undefined;
    
    const order = await optimizeRoute(newRouteStops, vehicleInfo);
    if (order && order.length === newRouteStops.length) {
      setProposedOrder(order);
    } else {
      alert("A IA não conseguiu encontrar uma rota melhor no momento.");
    }
    setIsOptimizing(false);
  };

  const applyAIOrder = async () => {
    if (!proposedOrder) return;
    const reorderedStops = proposedOrder.map(idx => newRouteStops[idx]);
    setNewRouteStops(reorderedStops);
    setProposedOrder(null);
    
    // Recalculate route
    const routes = await getRoute(reorderedStops.filter(s => s.lat) as {lat: number, lng: number}[]);
    setCalculatedRoute(routes ? routes[0] : null);
  };

  const handleSaveRoute = async () => {
    if (!calculatedRoute || !selectedVehicleId || !selectedDriverId || !profile?.companyId) {
      alert("Selecione veículo e motorista.");
      return;
    }
    
    const vehicle = vehicles.find(v => v.id === selectedVehicleId);
    const driver = drivers.find(d => d.uid === selectedDriverId);
    if (!vehicle || !driver) return;

    try {
      const routeData = {
        companyId: profile.companyId,
        date: new Date().toISOString(),
        driverId: driver.uid,
        driverName: driver.displayName,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        stops: newRouteStops.map((s, i) => ({ 
          id: `stop_${Math.random().toString(36).substr(2, 9)}`,
          name: i === 0 ? "Início / Carga" : i === newRouteStops.length - 1 ? "Retorno / Descarga" : `Cliente ${i}`, 
          address: s.address, 
          lat: s.lat, 
          lng: s.lng, 
          status: 'planned' as const,
          order: i 
        })),
        status: 'dispatching' as const,
        totalDistance: calculatedRoute.distance,
        totalTolls: estimateTolls(calculatedRoute.distance, vehicle.tollClass, tollRates),
        estimatedTime: calculatedRoute.duration,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'routes'), routeData);
      setNewRouteStops([]);
      setCalculatedRoute(null);
      setSelectedVehicleId('');
      setSelectedDriverId('');
      alert("Rota despachada para o motorista com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'routes');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Painel de Controlo</h2>
          <p className="text-slate-500 text-sm">Gestão de {isMaster ? 'todas as empresas' : profile?.companyId} em tempo real</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('simulator')} 
            className="flex-1 md:flex-none px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
          >
            Simulador
          </button>
          <button 
            onClick={() => setActiveTab('reports')} 
            className="flex-1 md:flex-none px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-900/40"
          >
            Relatórios
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Planning Card */}
        <div className="lg:col-span-4 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="lg:w-1/3 space-y-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-indigo-600 rounded-2xl">
                  <Navigation className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight uppercase text-xs tracking-[0.2em] opacity-50">Novo Despacho</h3>
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={newStopInput}
                    onChange={(e) => setNewStopInput(e.target.value)}
                    placeholder="Introduza endereço do cliente..."
                    className="flex-1 bg-slate-800/50 border border-slate-700 rounded-2xl px-4 py-4 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-600"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddStop()}
                  />
                  <button 
                    onClick={handleAddStop}
                    disabled={isGeocoding}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-2xl transition-all shadow-lg shadow-indigo-900/40 disabled:bg-slate-800 shrink-0"
                  >
                    {isGeocoding ? <Loader2 className="w-6 h-6 animate-spin" /> : <Plus className="w-6 h-6" />}
                  </button>
                </div>

                {newRouteStops.length >= 3 && !proposedOrder && (
                  <button 
                    onClick={handleAIOptimize}
                    disabled={isOptimizing}
                    className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-500/20 transition-all group"
                  >
                    {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />}
                    Inteligência Logística (Otimizar)
                  </button>
                )}

                {proposedOrder && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-indigo-600/20 border border-indigo-500/40 p-4 rounded-[1.5rem] space-y-4 shadow-xl"
                  >
                    <div className="flex items-center gap-3 text-indigo-300">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                      <span className="text-[11px] font-black uppercase tracking-widest">IA: Rota mais eficiente pronta</span>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={applyAIOrder}
                        className="flex-1 bg-white hover:bg-indigo-50 text-slate-950 text-[10px] font-black py-3 rounded-xl transition-all uppercase tracking-widest"
                      >
                        Aplicar
                      </button>
                      <button 
                        onClick={() => setProposedOrder(null)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-black py-3 rounded-xl transition-all uppercase tracking-widest"
                      >
                        Recusar
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-6">
              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar max-h-[300px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {newRouteStops.map((stop, i) => (
                    <div key={i} className="flex items-center gap-4 bg-slate-800/30 p-4 rounded-2xl border border-slate-700/30 group hover:border-indigo-500/30 transition-all">
                      <div className="w-8 h-8 rounded-xl bg-slate-700 text-[10px] flex items-center justify-center font-black text-white shrink-0 group-hover:bg-indigo-600 transition-colors">
                        {i + 1}
                      </div>
                      <p className="text-[11px] font-bold text-slate-300 truncate flex-1">{stop.address}</p>
                      <button 
                        onClick={() => setNewRouteStops(newRouteStops.filter((_, idx) => idx !== i))}
                        className="text-slate-700 hover:text-red-500 transition-all p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {newRouteStops.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-700">
                    <MapPin className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm font-bold uppercase tracking-widest opacity-20">Aguardando Destinos</p>
                  </div>
                )}
              </div>

              {calculatedRoute && (
                <div className="pt-6 border-t border-slate-800/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1 flex items-center gap-2">
                        <Truck className="w-3 h-3" /> Veículo Disponível
                      </label>
                      <select 
                        value={selectedVehicleId}
                        onChange={(e) => setSelectedVehicleId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                      >
                        <option value="">Selecionar Viatura...</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.name} ({v.licensePlate})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1 flex items-center gap-2">
                        <UserCheck className="w-3 h-3" /> Motorista
                      </label>
                      <select 
                        value={selectedDriverId}
                        onChange={(e) => setSelectedDriverId(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-4 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                      >
                        <option value="">Atribuir Motorista...</option>
                        {drivers.map(d => (
                          <option key={d.uid} value={d.uid}>{d.displayName}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button 
                    onClick={handleSaveRoute}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-8 py-5 rounded-2xl shadow-2xl shadow-indigo-900/40 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em]"
                  >
                    <Save className="w-5 h-5" />
                    Enviar Rota para Dispositivo do Motorista
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Map Area */}
        <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden min-h-[500px] relative shadow-2xl">
          <MapContainer 
            center={[38.7223, -9.1393]} 
            zoom={13} 
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {newRouteStops.map((stop, i) => stop.lat && stop.lng && (
              <Marker key={i} position={[stop.lat, stop.lng]}>
                <Popup>
                  <div className="text-xs font-bold text-slate-800">{i + 1}. {stop.address}</div>
                </Popup>
              </Marker>
            ))}
            {calculatedRoute && calculatedRoute.geometry && (
              <Polyline 
                positions={calculatedRoute.geometry.coordinates.map((c: any) => [c[1], c[0]])}
                color="#6366f1"
                weight={6}
                opacity={0.8}
              />
            )}
          </MapContainer>

          <AnimatePresence>
            {calculatedRoute && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="absolute top-6 left-6 z-10 bg-slate-950/90 border border-slate-800 rounded-[2rem] p-6 shadow-3xl backdrop-blur-xl"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-8">
                    <div>
                      <p className="text-2xl font-black text-white leading-none mb-1">{formatDistance(calculatedRoute.distance)}</p>
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Extensão Total</p>
                    </div>
                    <div className="w-px h-10 bg-slate-800"></div>
                    <div>
                      <p className="text-2xl font-black text-indigo-400 leading-none mb-1">{formatDuration(calculatedRoute.duration)}</p>
                      <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Tempo Operacional</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dashboard Stats */}
        <div className="flex flex-col gap-6 lg:col-span-1">
          <div className="flex-1 bg-indigo-600 rounded-[2.5rem] p-8 flex flex-col justify-between shadow-2xl shadow-indigo-900/50 group overflow-hidden relative">
             <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
               <Truck className="w-24 h-24" />
             </div>
             <div>
               <p className="text-indigo-200 text-xs font-black uppercase tracking-widest mb-1">Frotas Online</p>
               <h2 className="text-5xl font-black text-white leading-none">
                 {vehicles.filter(v => v.status === 'active').length}
                 <span className="text-xl opacity-50 ml-2 font-bold">/ {vehicles.length}</span>
               </h2>
             </div>
             <div className="flex items-end justify-between">
                <div className="flex -space-x-4">
                  {[...Array(Math.min(vehicles.length, 3))].map((_, i) => (
                    <div key={i} className={`w-10 h-10 rounded-2xl border-4 border-indigo-600 bg-indigo-${400 + (i * 100)} shadow-xl shadow-black/20`}></div>
                  ))}
                </div>
                <ChevronRight className="w-6 h-6 text-indigo-300" />
             </div>
          </div>

          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Estado das Rotas</p>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <h2 className="text-3xl font-black text-white leading-none mb-6">
              {routes.filter(r => r.status === 'in_transit').length}
              <span className="text-sm font-bold text-slate-500 ml-2">em serviço</span>
            </h2>
            <div className="space-y-4">
               <div className="flex justify-between text-[10px] font-black uppercase text-slate-500">
                  <span>Meta Diária</span>
                  <span>{Math.round((routes.filter(r => r.status === 'completed').length / (routes.length || 1)) * 100)}%</span>
               </div>
               <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                 <div 
                   className="h-full bg-emerald-500 transition-all duration-1000" 
                   style={{ width: `${(routes.filter(r => r.status === 'completed').length / (routes.length || 1)) * 100}%` }}
                 />
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
