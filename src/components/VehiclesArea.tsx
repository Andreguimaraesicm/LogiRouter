import React, { useState, useEffect } from 'react';
import { Truck, Plus, Trash2, Edit2, CheckCircle2, XCircle } from 'lucide-react';
import { collection, onSnapshot, addDoc, deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VEHICLE_TYPES } from '../constants';
import { Vehicle } from '../types';

export function VehiclesArea({ userRole }: { userRole?: string }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const isManager = userRole === 'master' || userRole === 'manager';
  const [newVehicle, setNewVehicle] = useState({ 
    name: '', 
    type: VEHICLE_TYPES[0], 
    licensePlate: '', 
    tollClass: 1 as any,
    status: 'active' as const,
    fuels: [] as { type: string, value: number }[]
  });

  const toggleFuel = (type: string, isEdit = false) => {
    if (isEdit && editingVehicle) {
      const fuels = [...editingVehicle.fuels];
      const idx = fuels.findIndex(f => f.type === type);
      if (idx > -1) {
         fuels.splice(idx, 1);
      } else {
        fuels.push({ type, value: 0 });
      }
      setEditingVehicle({ ...editingVehicle, fuels });
      return;
    }

    if (newVehicle.fuels.find(f => f.type === type)) {
      setNewVehicle({ ...newVehicle, fuels: newVehicle.fuels.filter(f => f.type !== type) });
    } else {
      setNewVehicle({ ...newVehicle, fuels: [...newVehicle.fuels, { type, value: 0 }] });
    }
  };

  const updateFuelValue = (type: string, value: number, isEdit = false) => {
    const val = isNaN(value) ? 0 : value;
    if (isEdit && editingVehicle) {
      const fuels = [...(editingVehicle.fuels || [])];
      const idx = fuels.findIndex(f => f.type === type);
      if (idx > -1) {
        fuels[idx] = { ...fuels[idx], value: val };
      } else {
        fuels.push({ type: type as any, value: val });
      }
      setEditingVehicle({ ...editingVehicle, fuels });
      return;
    }

    const fuels = [...newVehicle.fuels];
    const idx = fuels.findIndex(f => f.type === type);
    if (idx > -1) {
      fuels[idx] = { ...fuels[idx], value: val };
    } else {
      fuels.push({ type: type as any, value: val });
    }
    setNewVehicle({ ...newVehicle, fuels });
  };

  useEffect(() => {
    return onSnapshot(collection(db, 'vehicles'), snap => {
      setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle)));
    });
  }, []);

  const [isSaving, setIsSaving] = useState(false);

  const handleUpdate = async () => {
    if (!editingVehicle || !editingVehicle.id || !editingVehicle.name || !editingVehicle.licensePlate) {
      console.warn('Dados insuficientes para atualizar veículo:', editingVehicle);
      return;
    }
    setIsSaving(true);
    console.log('Iniciando atualização de veículo:', editingVehicle.id, editingVehicle);
    try {
      const vehicleRef = doc(db, 'vehicles', editingVehicle.id);
      // Create a clean copy of the data to avoid sending 'id' as a field
      // and ensuring no undefined values are sent.
      const { id, ...data } = editingVehicle;
      
      // Firestore doesn't like undefined, and we want to ensure everything is a plain object
      await updateDoc(vehicleRef, {
        name: data.name,
        type: data.type,
        licensePlate: data.licensePlate,
        tollClass: data.tollClass,
        status: data.status,
        fuels: data.fuels || []
      });
      
      console.log('Veículo atualizado no Firestore com sucesso!');
      setEditingVehicle(null);
    } catch (error: any) {
      console.error('Erro crítico ao atualizar veículo:', error);
      alert(`Erro ao atualizar veículo: ${error.message || 'Erro de conexão/permissões'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!newVehicle.name || !newVehicle.licensePlate) {
      alert('Por favor preencha o nome e a matrícula do veículo.');
      return;
    }
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'vehicles'), newVehicle);
      setIsAdding(false);
      setNewVehicle({ 
        name: '', 
        type: VEHICLE_TYPES[0], 
        licensePlate: '', 
        tollClass: 1, 
        status: 'active',
        fuels: []
      });
    } catch (error) {
      console.error("Error adding vehicle:", error);
      alert('Erro ao guardar veículo. Verifique a sua ligação ou permissões.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem a certeza que deseja apagar este veículo?')) {
      try {
        await deleteDoc(doc(db, 'vehicles', id));
      } catch (error) {
        console.error(error);
        alert('Erro ao apagar veículo.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Veículos</h2>
          <p className="text-slate-500 text-sm">Gerencie a frota da empresa</p>
        </div>
        {isManager && (
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-900/40 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Veículo
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map(vehicle => (
          <div key={vehicle.id} className="bento-card p-6 group hover:border-indigo-500/50">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-800 rounded-xl">
                <Truck className="w-6 h-6 text-indigo-500" />
              </div>
              {isManager && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setEditingVehicle(vehicle)}
                    className="text-slate-600 hover:text-indigo-400 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(vehicle.id)} className="text-slate-600 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            
            <h4 className="text-lg font-bold text-white mb-1">{vehicle.name}</h4>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-slate-800 text-slate-400 px-2 py-1 rounded">
                {vehicle.licensePlate}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest bg-indigo-950/40 text-indigo-400 px-2 py-1 rounded">
                Classe {vehicle.tollClass}
              </span>
            </div>

            {vehicle.fuels && vehicle.fuels.length > 0 && (
              <div className="space-y-1.5 mt-4">
                <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">Consumos Médios</p>
                <div className="flex flex-wrap gap-2">
                  {vehicle.fuels.filter(f => f.value > 0).map((f, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/50">
                      <span className="text-[9px] font-black uppercase text-indigo-400">{f.type === 'gasoleo' ? 'GAS' : f.type.toUpperCase()}</span>
                      <span className="text-[10px] text-white font-bold">{f.value.toFixed(1)} <span className="text-[8px] text-slate-500">{f.type === 'gnl' ? 'kg/100' : 'L/100'}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{vehicle.type}</p>
              <div className="flex items-center gap-1">
                {vehicle.status === 'active' ? (
                  <><CheckCircle2 className="w-4 h-4 text-green-500" /> <span className="text-xs text-green-500">Ativo</span></>
                ) : (
                  <><XCircle className="w-4 h-4 text-red-500" /> <span className="text-xs text-red-500">Parado</span></>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full max-w-md shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
            <h3 className="text-xl font-bold text-white mb-6">Editar Veículo</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Nome do Veículo</label>
                <input 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-sm"
                  value={editingVehicle.name}
                  onChange={e => setEditingVehicle({...editingVehicle, name: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Matrícula</label>
                <input 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-sm uppercase"
                  value={editingVehicle.licensePlate}
                  onChange={e => setEditingVehicle({...editingVehicle, licensePlate: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Tipo</label>
                  <select 
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-sm"
                    value={editingVehicle.type}
                    onChange={e => setEditingVehicle({...editingVehicle, type: e.target.value as any})}
                  >
                    {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Classe Via Verde</label>
                  <select 
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-sm"
                    value={editingVehicle.tollClass}
                    onChange={e => setEditingVehicle({...editingVehicle, tollClass: parseInt(e.target.value) as any})}
                  >
                    {[1,2,3,4].map(c => <option key={c} value={c}>Classe {c}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-500">Estado</label>
                <select 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-sm"
                  value={editingVehicle.status}
                  onChange={e => setEditingVehicle({...editingVehicle, status: e.target.value as any})}
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Parado</option>
                  <option value="maintenance">Manutenção</option>
                </select>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-black uppercase text-slate-500 block ml-1 tracking-widest">Combustíveis e Consumo / 100km</label>
                <div className="grid grid-cols-1 gap-2">
                  {['gasoleo', 'gnl', 'adblue'].map(f => {
                    const fuel = editingVehicle.fuels?.find(fuel => fuel.type === f);
                    return (
                      <div key={f} className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
                        <div className="w-20">
                          <span className="text-[10px] font-black uppercase text-slate-400">{f === 'gasoleo' ? 'Gásóleo' : f.toUpperCase()}</span>
                        </div>
                        <div className="flex-1 flex items-center gap-3">
                          <input 
                            type="number"
                            step="0.1"
                            placeholder="0.0"
                            value={fuel?.value || ''}
                            onChange={e => updateFuelValue(f, parseFloat(e.target.value), true)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                          />
                          <span className="text-[10px] text-slate-500 font-bold shrink-0 w-12">
                            {f === 'gnl' ? 'kg/100' : 'L/100'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setEditingVehicle(null)}
                className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-xl transition-colors hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button 
                onClick={handleUpdate}
                disabled={isSaving}
                className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:bg-indigo-500 shadow-indigo-900/20 disabled:bg-slate-700"
              >
                {isSaving ? 'A guardar...' : 'Atualizar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6">Adicionar Novo Veículo</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Nome do Veículo</label>
                <input 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-sm"
                  value={newVehicle.name}
                  onChange={e => setNewVehicle({...newVehicle, name: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Matrícula</label>
                <input 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-sm uppercase"
                  value={newVehicle.licensePlate}
                  onChange={e => setNewVehicle({...newVehicle, licensePlate: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Tipo</label>
                  <select 
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-sm"
                    value={newVehicle.type}
                    onChange={e => setNewVehicle({...newVehicle, type: e.target.value as any})}
                  >
                    {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500">Classe Via Verde</label>
                  <select 
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-sm"
                    value={newVehicle.tollClass}
                    onChange={e => setNewVehicle({...newVehicle, tollClass: parseInt(e.target.value)})}
                  >
                    {[1,2,3,4].map(c => <option key={c} value={c}>Classe {c}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-black uppercase text-slate-500 block ml-1 tracking-widest">Combustíveis e Consumo / 100km</label>
                <div className="grid grid-cols-1 gap-2">
                  {['gasoleo', 'gnl', 'adblue'].map(f => {
                    const fuel = newVehicle.fuels.find(fuel => fuel.type === f);
                    return (
                      <div key={f} className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
                        <div className="w-20">
                          <span className="text-[10px] font-black uppercase text-slate-400">{f === 'gasoleo' ? 'Gásóleo' : f.toUpperCase()}</span>
                        </div>
                        <div className="flex-1 flex items-center gap-3">
                          <input 
                            type="number"
                            step="0.1"
                            placeholder="0.0"
                            value={fuel?.value || ''}
                            onChange={e => updateFuelValue(f, parseFloat(e.target.value))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                          />
                          <span className="text-[10px] text-slate-500 font-bold shrink-0 w-12">
                            {f === 'gnl' ? 'kg/100' : 'L/100'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsAdding(false)}
                className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-xl transition-colors hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAdd}
                disabled={isSaving}
                className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:bg-indigo-500 shadow-indigo-900/20 disabled:bg-slate-700 disabled:shadow-none"
              >
                {isSaving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
