import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, Plus, Trash2, Navigation, Euro, 
  Clock, CheckCircle2, ChevronRight, Loader2, Save, Sparkles, Wand2, Fuel, UserCheck, Truck, Search, Menu, ArrowUp, ArrowDown, Settings
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { geocodeAddress, getRoute, estimateTolls } from '../services/routeService';
import { optimizeRoute } from '../services/aiService';
import { formatDuration, formatDistance, formatCurrency } from '../lib/formatters';
import { VEHICLE_TYPES } from '../constants';
import { Vehicle, RouteStop, Route, UserProfile, TollClass } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../lib/AuthContext';

// Marker fixes & Custom Icon styling
const markerIcon = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const markerShadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Leaflet Icons for aesthetic layout
const createNumIcon = (num: number) => {
  return L.divIcon({
    html: `<div class="w-7 h-7 rounded-full bg-indigo-600 border-2 border-white text-white flex items-center justify-center font-black text-xs shadow-lg shadow-black/40 hover:bg-indigo-500 transition-colors">${num}</div>`,
    className: 'custom-div-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
};

const startIcon = L.divIcon({
  html: `<div class="w-7 h-7 rounded-full bg-emerald-500 border-2 border-white text-white flex items-center justify-center font-black text-xs shadow-lg shadow-black/40 hover:bg-emerald-400 transition-colors">P</div>`,
  className: 'custom-div-icon',
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

interface ManagerDashboardProps {
  tollRates: Record<number, number>;
  setActiveTab: (tab: any) => void;
}

// Map Event Handler Component
function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
}

// Reverse Geocoding via Nominatim
async function reverseGeocode(lat: number, lng: number) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await response.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

export function ManagerDashboard({ tollRates, setActiveTab }: ManagerDashboardProps) {
  const { profile, isMaster } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<UserProfile[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Custom Planning States to match the image exactly
  const [startPointAddress, setStartPointAddress] = useState('Lisboa, Portugal');
  const [startPointLat, setStartPointLat] = useState(38.7223);
  const [startPointLng, setStartPointLng] = useState(-9.1393);
  const [isGeocodingStartPoint, setIsGeocodingStartPoint] = useState(false);

  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(() => {
    // default to today or '2026-05-20' format
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [maxSpeed, setMaxSpeed] = useState(100);
  const [tollClass, setTollClass] = useState<TollClass>(1);
  const [itineraryMode, setItineraryMode] = useState<'manual' | 'proximity'>('manual');

  // Paragem form states
  const [newStopName, setNewStopName] = useState('');
  const [newStopAddress, setNewStopAddress] = useState('');
  const [newRouteStops, setNewRouteStops] = useState<{id?: string, address: string, name: string, lat?: number, lng?: number}[]>([]);
  
  const [roundTrip, setRoundTrip] = useState(true); // default true: "IDA E VOLTA"
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [calculatedRoute, setCalculatedRoute] = useState<any>(null);

  // Load backend and configurations
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

    const cQuery = companyId ? query(collection(db, 'clients'), where('companyId', '==', companyId)) : collection(db, 'clients');
    const unsubClients = onSnapshot(cQuery, (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { 
      unsubVehicles(); 
      unsubDrivers(); 
      unsubRoutes(); 
      unsubClients();
    };
  }, [profile, isMaster]);

  // Handle selected client selection auto-filling stop address if clicked
  useEffect(() => {
    if (selectedClientId) {
      const selectedClient = clients.find(c => c.id === selectedClientId);
      if (selectedClient) {
        setNewStopName(selectedClient.name);
        setNewStopAddress(selectedClient.address);
      }
    }
  }, [selectedClientId, clients]);

  // Dynamic Routing Logic & Custom Speed optimization using nearest-neighbor sort
  const orderedStops = useMemo(() => {
    if (itineraryMode === 'manual' || newRouteStops.length < 2) {
      return newRouteStops;
    }
    
    // Nearest-neighbor algorithm based on geographic distance from Start Point (P)
    const start = { lat: startPointLat, lng: startPointLng };
    const unvisited = [...newRouteStops];
    const ordered: typeof newRouteStops = [];
    let current = start;

    while (unvisited.length > 0) {
      let nearestIdx = -1;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const stop = unvisited[i];
        if (stop.lat === undefined || stop.lng === undefined) continue;
        const dist = Math.pow(stop.lat - current.lat, 2) + Math.pow(stop.lng - current.lng, 2);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      if (nearestIdx === -1) {
        ordered.push(...unvisited);
        break;
      }

      const nStop = unvisited[nearestIdx];
      ordered.push(nStop);
      current = { lat: nStop.lat!, lng: nStop.lng! };
      unvisited.splice(nearestIdx, 1);
    }

    return ordered;
  }, [newRouteStops, startPointLat, startPointLng, itineraryMode]);

  // Run routing api dynamically
  useEffect(() => {
    let isSubscribed = true;
    
    const calculateRouteResult = async () => {
      if (orderedStops.length === 0) {
        if (isSubscribed) setCalculatedRoute(null);
        return;
      }

      const startNode = { lat: startPointLat, lng: startPointLng, address: startPointAddress };
      const routeNodes = [startNode, ...orderedStops];
      
      if (roundTrip) {
        routeNodes.push(startNode);
      }

      const validCoords = routeNodes.filter(s => 
        s.lat !== undefined && 
        s.lng !== undefined && 
        !isNaN(Number(s.lat)) && 
        !isNaN(Number(s.lng))
      ) as {lat: number, lng: number}[];
      
      if (validCoords.length < 2) return;

      const matchedVehicle = vehicles.find(v => v.id === selectedVehicleId);
      const vehicleType = matchedVehicle?.type || 'Ligeiro';

      const osrmRoutes = await getRoute(validCoords, vehicleType);
      if (!isSubscribed) return;

      if (osrmRoutes && osrmRoutes[0]) {
        const primaryRoute = osrmRoutes[0];
        
        // Speed optimization modifier
        const defaultSpeed = 80; // typical speed OSRM estimates on
        const speedRatio = defaultSpeed / Math.max(minSpeedValue(maxSpeed), 30);
        const adjustedDuration = primaryRoute.duration * speedRatio;

        const truckFactor = vehicleType === 'Pesado' ? 1.065 : 1.0;
        
        setCalculatedRoute({
          ...primaryRoute,
          distance: primaryRoute.distance * truckFactor,
          duration: adjustedDuration
        });
      } else {
        setCalculatedRoute(null);
      }
    };

    calculateRouteResult();

    return () => {
      isSubscribed = false;
    };
  }, [orderedStops, startPointLat, startPointLng, roundTrip, selectedVehicleId, vehicles, maxSpeed]);

  const minSpeedValue = (val: number) => {
    return val <= 0 ? 30 : val;
  };

  // Reordering controls for Gestor Ordena (manual mode)
  const moveStopIndex = (index: number, direction: 'up' | 'down') => {
    if (itineraryMode !== 'manual') return;
    const listCopy = [...newRouteStops];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= listCopy.length) return;
    
    // Swap locations
    const temp = listCopy[index];
    listCopy[index] = listCopy[targetIndex];
    listCopy[targetIndex] = temp;
    
    setNewRouteStops(listCopy);
  };

  // Safe manual geolocation trigger
  const handleGeocodeStartPoint = async () => {
    if (!startPointAddress.trim()) return;
    setIsGeocodingStartPoint(true);
    const result = await geocodeAddress(startPointAddress);
    if (result) {
      setStartPointAddress(result.display_name);
      setStartPointLat(result.lat);
      setStartPointLng(result.lng);
    } else {
      alert("Local de partida não encontrado.");
    }
    setIsGeocodingStartPoint(false);
  };

  // Map click handler to update partição point
  const handleMapClick = async (lat: number, lng: number) => {
    setIsGeocodingStartPoint(true);
    const resolvedAddress = await reverseGeocode(lat, lng);
    setStartPointAddress(resolvedAddress);
    setStartPointLat(lat);
    setStartPointLng(lng);
    setIsGeocodingStartPoint(false);
  };

  // Geocode paragem and add
  const handleAddStop = async () => {
    if (!newStopAddress.trim()) {
      alert("Adicione uma morada de entrega.");
      return;
    }
    setIsGeocoding(true);
    const result = await geocodeAddress(newStopAddress);
    if (result) {
      const finalName = newStopName.trim() || `Cliente #${newRouteStops.length + 1}`;
      setNewRouteStops([
        ...newRouteStops,
        {
          id: `stop-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: finalName,
          address: result.display_name,
          lat: result.lat,
          lng: result.lng
        }
      ]);
      setNewStopName('');
      setNewStopAddress('');
      setSelectedClientId(''); // clear selected emitter client fallback
    } else {
      alert("Endereço de entrega não encontrado.");
    }
    setIsGeocoding(false);
  };

  // Calculate simulated fuel cost
  const calculateEstimatedFuelCost = (distanceMeters: number) => {
    const km = distanceMeters / 1000;
    const vehicle = vehicles.find(v => v.id === selectedVehicleId);
    const consumptionRate = vehicle?.fuels?.[0]?.value || 7.5; // default 7.5 Liters/100km
    const dieselPrice = 1.62; // basic Portuguese diesel rate index
    const litersUsed = (km * consumptionRate) / 100;
    return litersUsed * dieselPrice;
  };

  const handleSaveRoute = async () => {
    if (!calculatedRoute || !selectedVehicleId || !selectedDriverId) {
      alert("Certifique-se que tem pelo menos uma paragem calculada, o veículo selecionado e o motorista atribuído.");
      return;
    }

    const vehicle = vehicles.find(v => v.id === selectedVehicleId);
    const driver = drivers.find(d => d.uid === selectedDriverId);
    if (!vehicle || !driver) return;

    try {
      const startNode = { 
        id: 'start_base', 
        name: "Garagem / Base", 
        address: startPointAddress, 
        lat: startPointLat, 
        lng: startPointLng, 
        status: 'planned' as const, 
        order: 0 
      };
      
      const middleStops = orderedStops.map((stop, index) => ({
        id: `stop_${Math.random().toString(36).substr(2, 9)}`,
        name: stop.name,
        address: stop.address,
        lat: stop.lat,
        lng: stop.lng,
        status: 'planned' as const,
        order: index + 1
      }));

      const fullStops = [startNode, ...middleStops];
      if (roundTrip) {
        fullStops.push({
          id: 'end_base',
          name: "Retorno / Final do Turno",
          address: startPointAddress,
          lat: startPointLat,
          lng: startPointLng,
          status: 'planned' as const,
          order: fullStops.length
        });
      }

      await addDoc(collection(db, 'routes'), {
        companyId: profile?.companyId || 'master',
        date: appointmentDate,
        driverId: driver.uid,
        driverName: driver.displayName,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        stops: fullStops,
        status: 'dispatching' as const,
        totalDistance: calculatedRoute.distance,
        totalTolls: estimateTolls(calculatedRoute.distance, tollClass, tollRates),
        estimatedTime: calculatedRoute.duration,
        createdAt: serverTimestamp()
      });

      // Reset planning canvas
      setNewRouteStops([]);
      setCalculatedRoute(null);
      setSelectedVehicleId('');
      setSelectedDriverId('');
      setSelectedClientId('');
      alert("Rota despachada e agendada com sucesso para o motorista!");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'routes');
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header Layout with Point of Departure integrated matching original layout perfectly */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight leading-tight">Planeamento Diário</h1>
          <p className="text-slate-500 text-sm">Configure o veículo e otimize as paragens.</p>
        </div>

        {/* Departure Station Card */}
        <div id="start-point-card" className="bg-[#0b1329] border border-[#10b981] rounded-2xl p-5 shadow-lg relative w-full lg:max-w-[420px] transition-all hover:border-[#10b981]/80">
          <span className="text-[10px] uppercase font-black tracking-widest text-[#10b981] block mb-2">
            PONTO DE PARTIDA (GARAGEM/ARMAZÉM)
          </span>
          <div className="relative flex items-center">
            <input 
              type="text" 
              value={startPointAddress}
              onChange={(e) => setStartPointAddress(e.target.value)}
              className="w-full bg-[#111827] border border-slate-700/60 rounded-xl pl-4 pr-12 py-3.5 text-xs text-slate-200 focus:border-emerald-400 outline-none transition-all placeholder:text-slate-600 font-medium"
              placeholder="Digite o ponto de partida principal..."
              onKeyDown={(e) => e.key === 'Enter' && handleGeocodeStartPoint()}
            />
            <button 
              onClick={handleGeocodeStartPoint} 
              disabled={isGeocodingStartPoint}
              className="absolute right-2 p-2 rounded-lg bg-[#10b981] hover:bg-[#10b981]/90 text-slate-950 transition-all flex items-center justify-center disabled:opacity-50"
            >
              {isGeocodingStartPoint ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[9px] text-slate-500 mt-2 leading-relaxed">
            Dica: Tente incluir Rua e Número ou C. Postal para maior precisão. Clique na lupa para validar o novo local.
          </p>
        </div>
      </header>

      {/* 2. Primary Configuration Grid block */}
      <div className="bg-[#0b1329]/65 border border-slate-800/80 rounded-[2rem] p-6 shadow-2xl space-y-6">
        {/* Row 1: Parameters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Driver Selection */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">ATRIBUIR MOTORISTA</label>
            <select 
              value={selectedDriverId}
              onChange={(e) => setSelectedDriverId(e.target.value)}
              className="w-full bg-[#111827] border border-slate-750 rounded-xl px-4 py-3.5 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500 appearance-none font-bold"
            >
              <option value="">Motorista...</option>
              {drivers.map(d => (
                <option key={d.uid} value={d.uid}>{d.displayName}</option>
              ))}
            </select>
          </div>

          {/* Agenda Scheduling */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">DATA DO AGENDAMENTO</label>
            <input 
              type="date"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              className="w-full bg-[#111827] border border-slate-755 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-400 font-bold"
            />
          </div>

          {/* Vehicle Selection dropdown */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">OU</label>
            <select 
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full bg-[#111827] border border-slate-750 rounded-xl px-4 py-3.5 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-505 appearance-none font-bold"
            >
              <option value="">Escolha um veículo da frota...</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.licensePlate})</option>
              ))}
            </select>
          </div>

          {/* Emitter Client Dropdown selection */}
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">CLIENTE EMISSOR (RESPONSÁVEL)</label>
            <select 
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full bg-[#111827] border border-slate-750 rounded-xl px-4 py-3.5 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500 appearance-none font-bold"
            >
              <option value="">Escolha o Cliente Principal...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Secondary numeric/class features */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4 border-t border-slate-800/40">
          {/* Max Speed Selector slider */}
          <div className="md:col-span-7 space-y-2">
            <div className="flex justify-between items-center pr-2">
              <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">VELOCIDADE MÁXIMA (KM/H)</label>
              <span className="text-sm font-black text-indigo-400 bg-slate-850 px-3 py-1 rounded-lg">{maxSpeed}</span>
            </div>
            <input 
              type="range"
              min={30}
              max={150}
              value={maxSpeed}
              onChange={(e) => setMaxSpeed(parseInt(e.target.value))}
              className="w-full h-1.5 bg-[#111827] rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Portal Toll Class Selection buttons */}
          <div className="md:col-span-5 space-y-2">
            <label className="text-[10px] uppercase font-black text-slate-400 tracking-wider block">CLASSE DE PORTAGEM</label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((cl) => (
                <button
                  key={cl}
                  onClick={() => setTollClass(cl as TollClass)}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 border ${
                    tollClass === cl
                      ? 'bg-amber-500 border-amber-600 text-[#0f172a] shadow-lg shadow-amber-500/20'
                      : 'bg-[#111827] border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  C {cl}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Central Itinerary bar layout with buttons */}
      <div className="bg-[#0b1329]/65 border border-slate-800/80 rounded-2xl p-4 shadow-xl">
        <span className="text-[10px] uppercase font-black tracking-widest text-[#10b981] block mb-2 px-1">
          CONFIGURAÇÃO DE ITINERÁRIO
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          {/* Gestor Ordena */}
          <button
            onClick={() => setItineraryMode('manual')}
            className={`flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              itineraryMode === 'manual'
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40'
                : 'bg-[#111827] border border-slate-850 text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Menu className="w-4 h-4" />
            Gestor Ordena
          </button>

          {/* Automático (Proximidade) */}
          <button
            onClick={() => setItineraryMode('proximity')}
            className={`flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              itineraryMode === 'proximity'
                ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-900/40'
                : 'bg-[#111827] border border-slate-850 text-slate-400 hover:text-white hover:bg-slate-800/40'
            }`}
          >
            <Navigation className="w-4 h-4 text-indigo-400" />
            Automático (Proximidade)
          </button>
        </div>
      </div>

      {/* 4. Split Bottom content workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left section: Stops form creation + Itinerary order tracking */}
        <div className="lg:col-span-5 space-y-6">
          {/* Paragem insertion form */}
          <div className="bg-[#0b1329]/60 border border-slate-800/80 rounded-3xl p-6 shadow-2xl">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" /> Paragem
            </h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">
                  NOME DO CLIENTE (DESTINATÁRIO)
                </label>
                <input 
                  type="text"
                  value={newStopName}
                  onChange={(e) => setNewStopName(e.target.value)}
                  placeholder="Ex: João Silva ou Empresa XYZ"
                  className="w-full bg-[#111827] border border-slate-750 rounded-xl px-4 py-3.5 text-xs text-slate-350 outline-none focus:ring-1 focus:ring-indigo-550 transition-all font-medium placeholder:text-slate-650"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block">
                  MORADA DE ENTREGA
                </label>
                <input 
                  type="text"
                  value={newStopAddress}
                  onChange={(e) => setNewStopAddress(e.target.value)}
                  placeholder="Morada (ex: Rua Augusta, Lisboa)"
                  className="w-full bg-[#111827] border border-slate-750 rounded-xl px-4 py-3.5 text-xs text-slate-350 outline-none focus:ring-1 focus:ring-indigo-550 transition-all font-medium placeholder:text-slate-650"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddStop()}
                />
              </div>

              <button 
                onClick={handleAddStop}
                disabled={isGeocoding || !newStopAddress.trim()}
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl transition-all tracking-[0.1em] text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-40"
              >
                {isGeocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Confirmar Paragem
              </button>
            </div>
          </div>

          {/* Itinerary listing with toggles */}
          <div className="bg-[#0b1329]/60 border border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-850 pb-4">
              <span className="text-[11px] uppercase font-black tracking-wider text-slate-200">
                ITINERÁRIO
              </span>
              
              {/* Ida e Volta / Só Ida Switch pills */}
              <div className="bg-[#111827] p-1 rounded-xl flex items-center border border-slate-800">
                <button
                  type="button"
                  onClick={() => setRoundTrip(true)}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                    roundTrip 
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Ida e Volta
                </button>
                <button
                  type="button"
                  onClick={() => setRoundTrip(false)}
                  className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                    !roundTrip 
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Só Ida
                </button>
              </div>
            </div>

            {/* Stop cards List */}
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {newRouteStops.length === 0 ? (
                <div className="border border-dashed border-slate-800 rounded-3xl py-12 text-center text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  Sem pontos de entrega.
                </div>
              ) : (
                orderedStops.map((stop, i) => (
                  <div 
                    key={stop.id || `viewstop-${stop.name}-${i}`} 
                    className="flex items-center justify-between bg-slate-900/50 p-3.5 rounded-2xl border border-slate-800 hover:border-indigo-500/20 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 shrink-0 rounded-lg bg-indigo-500/10 text-indigo-400 font-black text-xs flex items-center justify-center border border-indigo-500/20">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-200 truncate">{stop.name}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{stop.address}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {itineraryMode === 'manual' && (
                        <>
                          <button
                            onClick={() => moveStopIndex(i, 'up')}
                            disabled={i === 0}
                            className="p-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded disabled:opacity-20"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveStopIndex(i, 'down')}
                            disabled={i === newRouteStops.length - 1}
                            className="p-1 text-slate-500 hover:text-white hover:bg-slate-800 rounded disabled:opacity-20"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => setNewRouteStops(newRouteStops.filter((stopItem, idx) => stop.id ? stopItem.id !== stop.id : idx !== i))}
                        className="p-1.5 text-slate-650 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Calculate dynamic summary results */}
          {calculatedRoute && (
            <div className="bg-[#0b1329]/65 border border-slate-800 rounded-[2rem] p-6 shadow-2xl space-y-4">
              <span className="text-[10px] uppercase font-black tracking-widest text-[#10b981] block">
                AUDITORIA PARCIAL LOGÍSTICA
              </span>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#111827]/40 p-4 rounded-2xl border border-slate-800/30">
                  <p className="text-[9px] text-slate-500 font-bold uppercase">Extensão total</p>
                  <p className="text-lg font-black text-slate-200 mt-1">{formatDistance(calculatedRoute.distance)}</p>
                </div>
                
                <div className="bg-[#111827]/40 p-4 rounded-2xl border border-slate-800/30">
                  <p className="text-[9px] text-slate-500 font-bold uppercase">Tempo Operacional</p>
                  <p className="text-lg font-black text-[#10b981] mt-1">{formatDuration(calculatedRoute.duration)}</p>
                </div>

                <div className="bg-[#111827]/40 p-4 rounded-2xl border border-slate-800/30">
                  <p className="text-[9px] text-slate-500 font-bold uppercase">Portagens Estimadas</p>
                  <p className="text-lg font-black text-amber-400 mt-1">
                    {formatCurrency(estimateTolls(calculatedRoute.distance, tollClass, tollRates))}
                  </p>
                </div>

                <div className="bg-[#111827]/40 p-4 rounded-2xl border border-slate-800/30">
                  <p className="text-[9px] text-slate-500 font-bold uppercase">Combustível Estimado</p>
                  <p className="text-lg font-black text-indigo-400 mt-1">
                    {formatCurrency(calculateEstimatedFuelCost(calculatedRoute.distance))}
                  </p>
                </div>
              </div>

              {/* Confirm & save deployment bar */}
              <div className="pt-2">
                <button
                  onClick={handleSaveRoute}
                  disabled={!selectedDriverId || !selectedVehicleId}
                  className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    selectedDriverId && selectedVehicleId
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/30'
                      : 'bg-[#111827] text-slate-650 cursor-not-allowed border border-slate-800'
                  }`}
                >
                  {!selectedDriverId || !selectedVehicleId
                    ? "Falta Atribuir Motorista / Viatura"
                    : "Confirmar e Despachar Rota"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right section: Map viewer displaying route & interactive marker triggers */}
        <div className="lg:col-span-7 bg-[#0b1329] border border-slate-800 rounded-[2.5rem] overflow-hidden min-h-[550px] relative shadow-2xl flex flex-col">
          {/* Flat aesthetic top floating notification */}
          <div className="absolute top-6 left-6 z-10 bg-slate-950/90 border border-slate-800 rounded-2xl py-2.5 px-5 shadow-3xl backdrop-blur-md">
            <span className="text-[9.5px] font-black uppercase tracking-wider text-[#10b981] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              VISUALIZAÇÃO DE MAPA - CLIQUE PARA DEFINIR PARTIDA
            </span>
          </div>

          {(() => {
            const validStartLat = typeof startPointLat === 'number' && !isNaN(startPointLat) ? startPointLat : 38.7223;
            const validStartLng = typeof startPointLng === 'number' && !isNaN(startPointLng) ? startPointLng : -9.1393;

            return (
              <MapContainer 
                center={[validStartLat, validStartLng]} 
                zoom={12} 
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%', minHeight: '520px', flex: 1 }}
                className="z-0 transition-all rounded-[2.5rem]"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Click hook to dynamically redefine Starting point (Garagem) */}
                <MapClickHandler onMapClick={handleMapClick} />

                {/* Starting Point Marker */}
                <Marker position={[validStartLat, validStartLng]} icon={startIcon}>
                  <Popup>
                    <div className="text-xs font-bold text-slate-850">
                      <p className="font-extrabold text-indigo-650 mb-0.5">Ponto de Partida</p>
                      <p className="max-w-[180px] break-words">{startPointAddress}</p>
                    </div>
                  </Popup>
                </Marker>

                {/* Stop Markers - Safe mapping to prevent rendering raw text nodes like NaN */}
                {orderedStops.map((stop, i) => {
                  const latStr = String(stop.lat || '');
                  const lngStr = String(stop.lng || '');
                  const latVal = parseFloat(latStr);
                  const lngVal = parseFloat(lngStr);

                  if (isNaN(latVal) || isNaN(lngVal)) {
                    return null;
                  }

                  return (
                    <Marker key={stop.id || `marker-${stop.name}-${i}`} position={[latVal, lngVal]} icon={createNumIcon(i + 1)}>
                      <Popup>
                        <div className="text-xs text-slate-850">
                          <p className="font-extrabold text-[#10b981] mb-0.5">Paragem #{i + 1}</p>
                          <p className="font-semibold text-slate-800">{stop.name}</p>
                          <p className="max-w-[180px] break-words text-slate-500 mt-0.5">{stop.address}</p>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {/* Render Calculated Polyline - safe checking geometries */}
                {calculatedRoute && 
                 calculatedRoute.geometry && 
                 Array.isArray(calculatedRoute.geometry.coordinates) && 
                 calculatedRoute.geometry.coordinates.length > 0 && (
                  <Polyline 
                    positions={calculatedRoute.geometry.coordinates
                      .filter((c: any) => Array.isArray(c) && c.length >= 2 && !isNaN(Number(c[0])) && !isNaN(Number(c[1])))
                      .map((c: any) => [Number(c[1]), Number(c[0])])
                    }
                    key={calculatedRoute ? `polyline-${calculatedRoute.geometry.coordinates.length}-${calculatedRoute.distance || 0}` : 'poly-empty'} color="#6366f1"
                    weight={6}
                    opacity={0.8}
                  />
                )}
              </MapContainer>
            );
          })()}

          {/* Floating metrics summary inside the map wrapper */}
          <AnimatePresence>
            {calculatedRoute && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute bottom-6 right-6 z-10 bg-slate-950/90 border border-slate-800 rounded-[2rem] p-6 shadow-3xl backdrop-blur-md"
              >
                <div className="flex gap-8 items-center">
                  <div>
                    <h4 className="text-[10px] text-slate-500 font-black uppercase tracking-wide">Extensão Total</h4>
                    <p className="text-2xl font-black text-white mt-0.5">{formatDistance(calculatedRoute.distance)}</p>
                  </div>
                  <div className="w-px h-8 bg-slate-800" />
                  <div>
                    <h4 className="text-[10px] text-slate-500 font-black uppercase tracking-wide">Tempo Operacional</h4>
                    <p className="text-2xl font-black text-[#10b981] mt-0.5">{formatDuration(calculatedRoute.duration)}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
