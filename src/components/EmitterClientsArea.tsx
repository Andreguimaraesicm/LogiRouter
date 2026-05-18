import React, { useState, useEffect } from 'react';
import { Package, MapPin, Search, Plus, Trash2, Edit2, Loader2, Navigation } from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { geocodeAddress } from '../services/routeService';

export function EmitterClientsArea() {
  const { profile, isMaster } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  const [newClient, setNewClient] = useState({ name: '', address: '', contact: '' });

  useEffect(() => {
    if (!profile?.companyId && !isMaster) return;

    const q = isMaster 
      ? collection(db, 'clients')
      : query(collection(db, 'clients'), where('companyId', '==', profile?.companyId));

    const unsub = onSnapshot(q, (snap) => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return unsub;
  }, [profile, isMaster]);

  const handleAdd = async () => {
    if (!newClient.name || !newClient.address || !profile?.companyId) return;
    setGeocoding(true);
    
    try {
      const geo = await geocodeAddress(newClient.address);
      if (!geo) {
        alert("Endereço não encontrado.");
        setGeocoding(false);
        return;
      }

      await addDoc(collection(db, 'clients'), {
        ...newClient,
        companyId: profile.companyId,
        lat: geo.lat,
        lng: geo.lng,
        createdAt: serverTimestamp()
      });
      
      setNewClient({ name: '', address: '', contact: '' });
      setIsAdding(false);
    } catch (error) {
      alert("Erro ao adicionar cliente.");
    } finally {
      setGeocoding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Deseja remover este cliente?")) {
      await deleteDoc(doc(db, 'clients', id));
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Clientes e Destinos</h2>
          <p className="text-slate-500 text-sm">Base de dados de endereços da {profile?.companyId || 'empresa'}</p>
        </div>
        <div className="flex gap-4">
          <div className="relative w-64 hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-4 py-3 text-white text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-600 uppercase tracking-widest"
              placeholder="PESQUISAR..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-900/40 flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo Cliente
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
           <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] w-full max-w-md shadow-3xl">
              <h3 className="text-xl font-black text-white mb-6 uppercase tracking-widest">Registo de Cliente</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome / Empresa</label>
                  <input 
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    value={newClient.name}
                    onChange={e => setNewClient({...newClient, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Endereço Completo</label>
                  <input 
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    value={newClient.address}
                    onChange={e => setNewClient({...newClient, address: e.target.value})}
                    placeholder="Ex: Rua XPTO, Lisboa"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contacto (Opcional)</label>
                  <input 
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    value={newClient.contact}
                    onChange={e => setNewClient({...newClient, contact: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-8">
                 <button 
                   onClick={() => setIsAdding(false)}
                   className="flex-1 bg-slate-800 text-slate-400 font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-colors"
                 >
                   Cancelar
                 </button>
                 <button 
                   onClick={handleAdd}
                   disabled={geocoding}
                   className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/40 flex items-center justify-center gap-2"
                 >
                   {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                   Validar e Guardar
                 </button>
              </div>
           </div>
        </div>
      )}

      <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/30 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-800">
              <th className="px-8 py-6">Identificação</th>
              <th className="px-8 py-6">Endereço Georeferenciado</th>
              <th className="px-8 py-6">Contacto</th>
              <th className="px-8 py-6 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {filteredClients.map(client => (
              <tr key={client.id} className="border-b border-slate-800/50 hover:bg-indigo-600/5 transition-all group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-800 group-hover:bg-indigo-600/20 text-indigo-500 rounded-2xl transition-colors">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-white group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{client.name}</p>
                      <p className="text-[10px] text-slate-500 font-black uppercase">Cliente Ativo</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <div className="flex items-center gap-2 max-w-xs md:max-w-md lg:max-w-xl">
                    <MapPin className="w-4 h-4 text-slate-700 shrink-0" />
                    <p className="text-slate-400 truncate text-xs font-bold">{client.address}</p>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <p className="text-slate-400 font-mono text-xs">{client.contact || '--'}</p>
                </td>
                <td className="px-8 py-6">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleDelete(client.id)}
                      className="p-3 bg-slate-800 hover:bg-red-500/10 text-slate-500 hover:text-red-500 rounded-xl transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredClients.length === 0 && (
              <tr>
                <td colSpan={4} className="py-20 text-center">
                   <div className="opacity-10 mb-4 flex justify-center"><Navigation className="w-16 h-16" /></div>
                   <p className="text-slate-700 text-xs font-black uppercase tracking-[0.2em]">Nenhum cliente cadastrado</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
