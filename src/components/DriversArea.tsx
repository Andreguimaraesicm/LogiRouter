import React, { useState, useEffect } from 'react';
import { User, Plus, Trash2, Shield, Mail } from 'lucide-react';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Role } from '../types';
import { useAuth } from '../lib/AuthContext';

export function DriversArea() {
  const { profile, isMaster, register, deleteUserAccount } = useAuth();
  const [drivers, setDrivers] = useState<UserProfile[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newDriver, setNewDriver] = useState({ 
    username: '',
    displayName: '', 
    role: 'driver' as Role, 
    password: 'password123',
    status: 'active' as const
  });

  useEffect(() => {
    if (!profile && !isMaster) return;

    let q = query(collection(db, 'users'), where('role', '==', 'driver'));
    if (!isMaster) {
      q = query(q, where('companyId', '==', profile?.companyId));
    }

    const unsub = onSnapshot(q, snap => {
      setDrivers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });

    return unsub;
  }, [profile, isMaster]);

  const handleAdd = async () => {
    if (!newDriver.displayName || !newDriver.username || (!profile?.companyId && !isMaster)) return;
    
    try {
      await register(newDriver.username, newDriver.password, {
        displayName: newDriver.displayName,
        role: 'driver',
        companyId: profile?.companyId || 'master_tools'
      });
      
      setIsAdding(false);
      setNewDriver({ username: '', displayName: '', role: 'driver', password: 'password123', status: 'active' });
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao criar motorista: ${err.message || 'Erro desconhecido'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Motoristas</h2>
          <p className="text-slate-500 text-sm">Controle de acesso e atividade</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-900/40 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Motorista
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map(driver => (
          <div key={driver.uid} className="bento-card p-6 hover:border-indigo-500/50">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-500">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white leading-tight">{driver.displayName}</h4>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">@{driver.username}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-slate-400">
                <Mail className="w-4 h-4" />
                <span className="text-xs">{driver.email || 'Nenhum email'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <Shield className="w-4 h-4" />
                <span className="text-xs capitalize">{driver.role}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button 
                onClick={async () => {
                  if (confirm('Deseja realmente apagar este motorista de forma definitiva do sistema (incluindo acessos de login)?')) {
                    try {
                      await deleteUserAccount(driver.uid);
                      alert('Motorista apagado com sucesso.');
                    } catch (err: any) {
                      alert('Erro ao apagar motorista: ' + (err.message || err));
                    }
                  }
                }}
                className="text-slate-600 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6">Adicionar Motorista</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Nome Completo</label>
                <input 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newDriver.displayName}
                  onChange={e => setNewDriver({...newDriver, displayName: e.target.value})}
                  placeholder="ex: João Silva"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Nome de Utilizador</label>
                <input 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newDriver.username}
                  onChange={e => setNewDriver({...newDriver, username: e.target.value})}
                  placeholder="ex: jsilva"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Palavra-passe Inicial</label>
                <input 
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newDriver.password}
                  onChange={e => setNewDriver({...newDriver, password: e.target.value})}
                />
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
                className="flex-1 bg-green-600 text-white font-bold py-3 rounded-xl transition-all shadow-lg hover:bg-green-500 shadow-green-900/20"
              >
                Criar Conta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
