import React, { useState, useEffect } from 'react';
import { 
  MapPin, Plus, Trash2, Navigation, Euro, 
  Clock, CheckCircle2, ChevronRight, Loader2, Save, Sparkles, Wand2, Fuel
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { geocodeAddress, getRoute, estimateTolls } from '../services/routeService';
import { optimizeRoute } from '../services/aiService';
import { formatDuration, formatDistance, formatCurrency } from '../lib/formatters';
import { VEHICLE_TYPES } from '../constants';
import { Vehicle, Client, Route } from '../types';
import { motion, AnimatePresence } from 'motion/react';

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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  
  // New Route State
  const [newRouteStops, setNewRouteStops] = useState<{address: string, lat?: number, lng?: number}[]>([]);
  const [newStopInput, setNewStopInput] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [calculatedRoute, setCalculatedRoute] = useState<any>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [proposedOrder, setProposedOrder] = useState<number[] | null>(null);

  useEffect(() => {
    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), (snap) => {
      setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
    });

    const qRoutes = query(collection(db, 'routes'), orderBy('date', 'desc'));
    const unsubRoutes = onSnapshot(qRoutes, (snap) => {
      setRoutes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Route)));
      setLoading(false);
    });

    return () => { unsubVehicles(); unsubRoutes(); };
  }, []);

  const handleAddStop = async () => {
    if (!newStopInput.trim()) return;
    setIsGeocoding(true);
    const result = await geocodeAddress(newStopInput);
    if (result) {
      const newStops = [...newRouteStops, { address: result.display_name, lat: result.lat, lng: result.lng }];
      setNewRouteStops(newStops);
      setNewStopInput('');
      
      if (newStops.length >= 2) {
        const routes = await getRoute(newStops.filter(s => s.lat) as {lat: number, lng: number}[]);
        setCalculatedRoute(routes ? routes[0] : null);
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
    if (!calculatedRoute || !selectedVehicleId) return;
    
    const vehicle = vehicles.find(v => v.id === selectedVehicleId);
    if (!vehicle) return;

    try {
      const routeData = {
        date: new Date().toISOString(),
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        stops: newRouteStops.map((s, i) => ({ 
          name: `Paragem ${i + 1}`, 
          address: s.address, 
          lat: s.lat, 
          lng: s.lng, 
          status: 'pending' as const,
          order: i 
        })),
        status: 'pending' as const,
        totalDistance: calculatedRoute.distance,
        totalTolls: estimateTolls(calculatedRoute.distance, vehicle.tollClass, tollRates),
        estimatedTime: calculatedRoute.duration,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'routes'), routeData);
      setNewRouteStops([]);
      setCalculatedRoute(null);
      alert("Rota guardada com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'routes');
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Painel de Gestão</h2>
          <p className="text-slate-500 text-sm">Estado em tempo real da frota e rotas</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab('simulator')} 
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Simulador
          </button>
          <button 
            onClick={() => setActiveTab('reports')} 
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-900/40"
          >
            Relatórios XLS
          </button>
        </div>
      </header>

      <div className="bento-grid min-h-[800px]">
        {/* Planning Card (Now at the top) */}
        <div className="md:col-span-4 bento-card p-6 flex flex-col md:flex-row gap-6">
          <div className="md:w-1/3 flex flex-col">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-500" />
              Novo Planeamento
            </h3>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <input 
                  type="text"
                  value={newStopInput}
                  onChange={(e) => setNewStopInput(e.target.value)}
                  placeholder="Introduza endereço..."
                  className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddStop()}
                />
                <button 
                  onClick={handleAddStop}
                  disabled={isGeocoding}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg transition-colors disabled:bg-slate-800"
                >
                  {isGeocoding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                </button>
              </div>

              {newRouteStops.length >= 3 && !proposedOrder && (
                <button 
                  onClick={handleAIOptimize}
                  disabled={isOptimizing}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-xs font-semibold hover:bg-indigo-500/20 transition-all"
                >
                  {isOptimizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  Otimizar Sequência (IA)
                </button>
              )}

              {proposedOrder && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-indigo-600/20 border border-indigo-500/40 p-3 rounded-xl space-y-2"
                >
                  <div className="flex items-center gap-2 text-indigo-300">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[11px] font-bold uppercase">Proposta da IA pronta</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={applyAIOrder}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold py-1.5 rounded-lg transition-all"
                    >
                      Aceitar
                    </button>
                    <button 
                      onClick={() => setProposedOrder(null)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-bold py-1.5 rounded-lg transition-all"
                    >
                      Rejeitar
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar max-h-[160px] md:max-h-none">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {newRouteStops.map((stop, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-800/40 p-2 rounded-lg border border-slate-700/50 group">
                    <div className="w-5 h-5 rounded bg-slate-700 text-[9px] flex items-center justify-center font-bold text-white shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-[11px] text-slate-300 truncate flex-1">{stop.address}</p>
                    <button 
                      onClick={() => setNewRouteStops(newRouteStops.filter((_, idx) => idx !== i))}
                      className="text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              {newRouteStops.length === 0 && (
                <div className="flex flex-col items-center justify-center h-24 text-slate-600 opacity-50">
                  <MapPin className="w-8 h-8 mb-2" />
                  <p className="text-xs italic">Adicione paragens para projetar a rota</p>
                </div>
              )}
            </div>

            {calculatedRoute && (
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1 w-full space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Veículo</label>
                  <select 
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Selecionar da Frota...</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.name} ({v.licensePlate})</option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={handleSaveRoute}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold px-8 py-3 rounded-xl shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Finalizar Rota
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Map Card */}
        <div className="md:col-span-3 md:row-span-2 bento-card overflow-hidden relative min-h-[500px]">
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
                weight={4}
                opacity={0.6}
                dashArray="10, 10"
              />
            )}
          </MapContainer>

          {/* Stats Overlay */}
          <AnimatePresence>
            {calculatedRoute && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="absolute top-4 left-4 z-10 bg-slate-900/90 border border-slate-700 rounded-xl p-4 shadow-2xl backdrop-blur-md"
              >
                <h3 className="text-[10px] font-semibold uppercase text-slate-500 mb-2 tracking-widest">Resumo do Planeamento</h3>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xl font-bold text-white">{formatDistance(calculatedRoute.distance)}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Distância</p>
                  </div>
                  <div className="w-px h-8 bg-slate-800"></div>
                  <div>
                    <p className="text-xl font-bold text-indigo-400">{formatDuration(calculatedRoute.duration)}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Tempo Est.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Side Cards (Right of Map) */}
        <div className="flex flex-col gap-4 md:col-span-1 md:row-span-2">
          {/* Active Capacity Card */}
          <div className="flex-1 bg-indigo-600 rounded-[24px] p-6 flex flex-col justify-between shadow-2xl shadow-indigo-900/40">
            <div>
              <p className="text-indigo-200 text-sm font-medium">Veículos Ativos</p>
              <h2 className="text-4xl font-bold flex items-baseline gap-2">
                {vehicles.filter(v => v.status === 'active').length}
                <span className="text-lg opacity-60 font-medium">/ {vehicles.length}</span>
              </h2>
            </div>
            <div className="flex -space-x-2">
              {[...Array(Math.min(vehicles.length, 4))].map((_, i) => (
                <div key={i} className={`w-8 h-8 rounded-full border-2 border-indigo-600 bg-indigo-${300 + (i * 100)}`}></div>
              ))}
            </div>
          </div>

          {/* Pricing snapshot */}
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-[24px] p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-slate-400 text-sm font-medium">Preço Atual Gasóleo</p>
              <div className="text-emerald-500 scale-90">
                <Fuel className="w-4 h-4" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">1.642 <span className="text-sm text-slate-500 font-normal">€/L</span></p>
            <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-tight">Atualizado há 10 min</p>
          </div>
        </div>

        {/* Financial Snapshot (Bottom Full Width) */}
        <div className="md:col-span-4 bento-card p-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1 w-full">
            <h3 className="text-sm font-semibold mb-4 text-slate-300">Resumo Operacional Diário</h3>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Combustível Est.</p>
                </div>
                <p className="text-2xl font-bold text-white">482.45 €</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Portagens Est.</p>
                </div>
                <p className="text-2xl font-bold text-white">124.10 €</p>
              </div>
            </div>
          </div>
          <div className="flex-1 w-full max-w-md space-y-4">
            <div className="flex justify-between text-xs text-slate-400 font-bold uppercase tracking-widest">
              <span>Eficiência da Frota</span>
              <span>82%</span>
            </div>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
              <div className="w-[82%] bg-gradient-to-r from-indigo-600 to-indigo-400 transition-all duration-1000"></div>
            </div>
            <p className="text-[10px] text-slate-500 italic text-center">Baseado em 14 rotas concluídas hoje</p>
          </div>
        </div>
      </div>
    </div>
  );
}
