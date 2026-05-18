import React, { useState, useEffect } from 'react';
import { 
  Calculator, MapPin, Truck, HelpCircle, 
  Plus, Trash2, ArrowRight, TrendingUp,
  LayoutGrid, Users, Settings, User, Loader2
} from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Vehicle, FuelConsumption } from '../types';
import { formatCurrency } from '../lib/formatters';
import { geocodeAddress, getRoute, estimateTolls } from '../services/routeService';

export function SimulatorArea({ fuelPrices, tollRates }: any) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [origin, setOrigin] = useState('Lisboa');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [profitMargin, setProfitMargin] = useState(20);
  const [currentFuelPrices, setCurrentFuelPrices] = useState(fuelPrices || {});
  
  // New entry form
  const [clientName, setClientName] = useState('');
  const [destination, setDestination] = useState('');
  const [roundTrip, setRoundTrip] = useState(true);
  const [distance, setDistance] = useState<number | string>('');
  const [tolls, setTolls] = useState<number | string>('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [routeOptions, setRouteOptions] = useState<any[]>([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState<number | null>(null);

  const [simulatedEntries, setSimulatedEntries] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vehicles'), (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
      setVehicles(list);
    });
    return () => unsub();
  }, []);

  const calculateAutoDistance = async () => {
    if (!origin || !destination) return;
    setIsCalculating(true);
    setRouteOptions([]);
    setSelectedRouteIdx(null);
    try {
      const originRes = await geocodeAddress(origin);
      const destRes = await geocodeAddress(destination);
      
      if (originRes && destRes) {
        const vehicle = vehicles.find(v => v.id === selectedVehicleId);
        if (vehicle) {
          const routes = await getRoute([originRes, destRes], vehicle.type, true);
          if (routes && routes.length > 0) {
            const options = routes.map((r: any, idx: number) => {
              const baseDist = Math.round(r.distance / 1000);
              const baseTolls = estimateTolls(r.distance, vehicle.tollClass, tollRates);
              
              // We simulate 3 types: FASTEST, NO_TOLLS (heuristic), MIXED
              let type = "Mista";
              let finalTolls = Math.round(baseTolls * 100) / 100;
              
              if (idx === 0) type = "Mais Rápida (C/ Portagens)";
              if (idx === 1) {
                type = "Económica (S/ Portagens)";
                finalTolls = 0; // Force 0 for economic option
              }
              if (idx === 2) type = "Alternativa";

              return {
                type,
                distance: baseDist,
                tolls: finalTolls,
                duration: r.duration
              };
            });
            setRouteOptions(options);
            // Default to fastest
            selectRoute(0, options[0]);
          }
        }
      }
    } catch (err) {
      console.error("Auto calculation error:", err);
    } finally {
      setIsCalculating(false);
    }
  };

  const selectRoute = (idx: number, opt: any) => {
    setSelectedRouteIdx(idx);
    setDistance(opt.distance);
    setTolls(opt.tolls);
  };

  const handleAddEntry = () => {
    if (!clientName || !destination || !distance) return;
    
    const newEntry = {
      id: Date.now(),
      clientName,
      destination,
      roundTrip,
      distance: Number(distance),
      tolls: Number(tolls) || 0
    };

    setSimulatedEntries([...simulatedEntries, newEntry]);
    setClientName('');
    setDestination('');
    setDistance('');
    setTolls('');
    setRouteOptions([]);
    setSelectedRouteIdx(null);
  };

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  const calculateCosts = (entry: any) => {
    const kmTotal = entry.roundTrip ? entry.distance * 2 : entry.distance;
    const tollTotal = entry.roundTrip ? entry.tolls * 2 : entry.tolls;
    let fuelTotalCost = 0;
    const fuelBreakdown: any[] = [];

    if (selectedVehicle && selectedVehicle.fuels) {
      selectedVehicle.fuels.forEach(f => {
        const price = currentFuelPrices[f.type] || 0;
        const amount = (kmTotal / 100) * f.value;
        const cost = amount * price;
        fuelTotalCost += cost;
        fuelBreakdown.push({ type: f.type, cost, amount });
      });
    }

    const totalCost = fuelTotalCost + tollTotal;
    const recommendedRevenue = totalCost / (1 - profitMargin / 100);

    return { totalCost, fuelTotalCost, tollTotal, fuelBreakdown, recommendedRevenue };
  };

  return (
    <div className="flex flex-col h-full gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Calculator className="w-6 h-6 text-indigo-500" />
          Simulador de Custos
        </h1>
        <p className="text-slate-500 text-sm font-medium">
          Simule viagens e preveja ganhos com base nos custos operacionais reais.
        </p>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* Left Column - Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Configuração Base */}
          <div className="bento-card p-6 border-indigo-500/20 bg-slate-900/40">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Configuração Operacional</h3>
            
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Ponto de Partida</label>
                <input 
                  type="text"
                  value={origin}
                  onChange={e => setOrigin(e.target.value)}
                  className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Veículo</label>
                <div className="relative">
                  <select 
                    value={selectedVehicleId}
                    onChange={e => setSelectedVehicleId(e.target.value)}
                    className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none appearance-none transition-all"
                  >
                    <option value="">Selecionar Veículo...</option>
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.licensePlate}) - Classe {v.tollClass}
                      </option>
                    ))}
                  </select>
                  <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none rotate-90" />
                </div>
                
                {selectedVehicle && selectedVehicle.fuels && selectedVehicle.fuels.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 px-1">
                    {selectedVehicle.fuels.filter(f => f.value > 0).map((f, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-slate-800/60 px-2 py-1 rounded-lg border border-slate-700/50">
                        <span className="text-[9px] font-black uppercase text-indigo-400">{f.type === 'gasoleo' ? 'GAS' : f.type.toUpperCase()}</span>
                        <span className="text-[10px] text-white font-bold">{f.value.toFixed(1)}<span className="text-[8px] text-slate-500">{f.type === 'gnl' ? 'kg' : 'L'}</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Preços dos Combustíveis (S/IVA)</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.keys(currentFuelPrices).map(type => (
                    <div key={type} className="space-y-1">
                      <span className="text-[9px] font-black uppercase text-slate-600 block ml-1">{type}</span>
                      <input 
                        type="number"
                        step="0.001"
                        value={currentFuelPrices[type]}
                        onChange={e => setCurrentFuelPrices({...currentFuelPrices, [type]: parseFloat(e.target.value)})}
                        className="w-full bg-slate-800/40 border border-slate-700/50 rounded-lg px-2 py-2 text-xs text-white outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase">Margem de Lucro (%)</label>
                  <span className="text-xs font-bold text-indigo-400">{profitMargin}%</span>
                </div>
                <input 
                  type="range"
                  min="0"
                  max="100"
                  value={profitMargin}
                  onChange={e => setProfitMargin(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Adicionar Cliente Simulador */}
          <div className="bento-card p-6 border-indigo-500/10 bg-slate-900/40">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-6">Nova Carga / Cliente</h3>

            <div className="space-y-4">
              <input 
                type="text"
                placeholder="Nome do Cliente"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
              />
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Cidade de Destino"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  className="flex-1 bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                />
                <button 
                  onClick={calculateAutoDistance}
                  disabled={isCalculating || !destination || !selectedVehicleId}
                  className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 p-3 rounded-xl transition-all disabled:opacity-50"
                  title={!selectedVehicleId ? "Selecione um veículo primeiro" : "Calcular Rota"}
                >
                  {isCalculating ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                </button>
              </div>

              {routeOptions.length > 0 && (
                <div className="space-y-2 pt-2">
                  <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Opções de Rota</label>
                  <div className="grid grid-cols-1 gap-2">
                    {routeOptions.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => selectRoute(idx, opt)}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                          selectedRouteIdx === idx 
                          ? 'bg-indigo-600/20 border-indigo-500 text-white' 
                          : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        <div>
                          <p className="text-[10px] font-bold uppercase">{opt.type}</p>
                          <p className="text-xs font-bold">{opt.distance} km • {formatCurrency(opt.tolls)}</p>
                        </div>
                        {selectedRouteIdx === idx && <div className="w-2 h-2 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20"></div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 px-1">
                <input 
                  type="checkbox"
                  id="roundTrip"
                  checked={roundTrip}
                  onChange={e => setRoundTrip(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="roundTrip" className="text-[10px] font-bold uppercase text-slate-500">Ida e Volta</label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-tighter text-slate-600 ml-1">Distância (KM)</label>
                  <input 
                    type="number"
                    value={distance}
                    onChange={e => setDistance(e.target.value)}
                    className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-tighter text-slate-600 ml-1">Portagens (S/IVA)</label>
                  <input 
                    type="number"
                    value={tolls}
                    onChange={e => setTolls(e.target.value)}
                    className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all"
                  />
                </div>
              </div>

              <button 
                onClick={handleAddEntry}
                disabled={!clientName || !destination || !distance || !selectedVehicleId}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-900/20 transition-all text-xs tracking-widest mt-2 uppercase"
              >
                {!selectedVehicleId ? 'Selecione Veículo' : 'Simular Rota'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="lg:col-span-8 bento-card border-slate-800/50 bg-slate-900/20 flex flex-col min-h-[600px] relative overflow-hidden">
          {simulatedEntries.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="mb-6 opacity-20">
                <LayoutGrid className="w-24 h-24 text-indigo-500" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2 uppercase tracking-tight">Cálculo em Tempo Real</h2>
              <p className="text-slate-500 text-sm max-w-sm font-medium">
                ADICIONE DESTINOS PARA CALCULAR AUTOMATICAMENTE CONSUMOS E MARGENS
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {simulatedEntries.map(entry => {
                  const { totalCost, fuelBreakdown, tollTotal, recommendedRevenue } = calculateCosts(entry);
                  const kmTotal = entry.roundTrip ? entry.distance * 2 : entry.distance;

                  return (
                    <div key={entry.id} className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 group hover:border-indigo-500/30 transition-all">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h4 className="text-white font-bold leading-none mb-1">{entry.clientName}</h4>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-tight">
                              {entry.destination} • {kmTotal}km {entry.roundTrip ? '(Ida e Volta)' : '(Apenas Ida)'}
                            </p>
                            {selectedVehicle && (
                              <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-black border border-slate-700">
                                C{selectedVehicle.tollClass}
                              </span>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={() => setSimulatedEntries(simulatedEntries.filter(e => e.id !== entry.id))}
                          className="p-2 hover:bg-red-500/10 text-slate-600 hover:text-red-500 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="space-y-3 mb-6">
                        <div className="flex justify-between border-b border-slate-800/50 pb-2">
                          <span className="text-[11px] text-slate-500 font-bold uppercase">Custos Detalhados (C/ Retorno)</span>
                        </div>
                        
                        {fuelBreakdown.length > 0 ? fuelBreakdown.map((f: any) => (
                          <div key={f.type} className="flex justify-between items-baseline">
                            <span className="text-[11px] text-slate-400 font-medium capitalize">{f.type}</span>
                            <div className="text-right">
                              <span className="text-[11px] text-slate-300 font-bold">{f.amount.toFixed(1)}{f.type === 'gnl' ? 'kg' : 'L'}</span>
                              <span className="text-[9px] text-slate-600 font-bold ml-2">({formatCurrency(f.cost)})</span>
                            </div>
                          </div>
                        )) : (
                          <p className="text-[10px] text-orange-500 font-bold italic">Sem combustível configurado!</p>
                        )}

                        <div className="flex justify-between items-baseline">
                          <span className="text-[11px] text-slate-400 font-medium italic">Portagens</span>
                          <span className="text-[11px] text-slate-300 font-bold">{formatCurrency(tollTotal)}</span>
                        </div>
                      </div>

                      <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Receita Recomendada</p>
                          <p className="text-2xl font-black text-indigo-400">{formatCurrency(recommendedRevenue)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Custo Total Est.</p>
                          <p className="text-sm font-bold text-white">{formatCurrency(totalCost)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {simulatedEntries.length > 0 && (
            <div className="p-8 bg-slate-900/60 border-t border-slate-800/80 backdrop-blur-md">
              <div className="flex flex-col md:flex-row gap-8 justify-between items-center">
                <div className="flex gap-12">
                  <div>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2">Total Custos Operacionais</p>
                    <p className="text-4xl font-black text-white">
                      {formatCurrency(simulatedEntries.reduce((acc, entry) => acc + calculateCosts(entry).totalCost, 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-indigo-400/70 font-black uppercase tracking-widest mb-2">Volume de Negócios Prep.</p>
                    <p className="text-4xl font-black text-indigo-500">
                      {formatCurrency(simulatedEntries.reduce((acc, entry) => acc + calculateCosts(entry).recommendedRevenue, 0))}
                    </p>
                  </div>
                </div>
                
                <button className="w-full md:w-auto bg-white text-slate-950 font-black px-12 py-5 rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all text-xs tracking-widest uppercase">
                  Imprimir Proposta
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

