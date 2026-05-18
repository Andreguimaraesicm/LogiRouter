import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Shield, Search, Mail, UserPlus, X, User } from 'lucide-react';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, where, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Role } from '../types';
import { useAuth } from '../lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export function UsersManagementArea() {
  const { profile, isMaster } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [newUser, setNewUser] = useState({ 
    username: '', 
    password: '',
    displayName: '', 
    role: 'collaborator' as Role,
    status: 'active' as const
  });

  useEffect(() => {
    if (!profile && !isMaster) return;

    const baseQuery = collection(db, 'users');
    let q = isMaster 
      ? baseQuery 
      : query(baseQuery, where('companyId', '==', profile?.companyId));

    const unsub = onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      setLoading(false);
    });

    return unsub;
  }, [profile, isMaster]);

  const handleAdd = async () => {
    if (!newUser.username || !newUser.password || !newUser.displayName) return;
    
    try {
      // Just save to Firestore. AuthContext login handles the rest.
      await addDoc(collection(db, 'users'), {
        ...newUser,
        username: newUser.username.toLowerCase().trim(),
        companyId: profile?.companyId || 'master_tools',
        createdAt: new Date().toISOString()
      });
      
      setIsAdding(false);
      setNewUser({ username: '', password: '', displayName: '', role: 'collaborator', status: 'active' });
      alert('Utilizador criado com sucesso.');
    } catch (err) {
      console.error(err);
      alert('Erro ao registar utilizador.');
    }
  };

  const toggleStatus = async (user: UserProfile) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        status: user.status === 'active' ? 'disabled' : 'active'
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-slate-500">A carregar utilizadores...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Gestão de Equipa</h2>
          <p className="text-slate-500">Controle de acessos e colaboradores da {isMaster ? 'Sistema Global' : 'sua Empresa'}</p>
        </div>
        {!isMaster && (
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-xl shadow-indigo-900/20 font-bold text-sm"
          >
            <UserPlus className="w-5 h-5" />
            Adicionar Colaborador
          </button>
        )}
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/30 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-800">
                <th className="px-6 py-5">Colaborador</th>
                <th className="px-6 py-5">Função</th>
                <th className="px-6 py-5">Estado</th>
                <th className="px-6 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-300">
              {users.map(user => (
                <tr key={user.uid} className="border-t border-slate-800/50 hover:bg-slate-800/20 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-black text-xs border border-indigo-500/20">
                        {user.displayName?.[0].toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-bold text-white group-hover:text-indigo-400 transition-colors">{user.displayName}</p>
                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3" /> @{user.username}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                      user.role === 'admin' ? 'bg-amber-500/10 border-amber-500/40 text-amber-500' : 
                      user.role === 'driver' ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-500' : 
                      'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <button 
                      onClick={() => toggleStatus(user)}
                      className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                        user.status === 'active' ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                      {user.status === 'active' ? 'Ativo' : 'Suspenso'}
                    </button>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button 
                      onClick={async () => {
                        if(confirm('Revogar todos os acessos deste utilizador?')) await deleteDoc(doc(db, 'users', user.uid));
                      }}
                      className="text-slate-700 hover:text-rose-500 transition-all p-2 rounded-xl hover:bg-rose-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-600 italic">
                    Ainda não existem colaboradores registados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] w-full max-w-md shadow-3xl relative"
          >
            <button onClick={() => setIsAdding(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-indigo-600 rounded-2xl">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">Adicionar Colaborador</h3>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cargo / Função</label>
                <select 
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value as Role})}
                >
                  <option value="collaborator">Administrativo (Colaborador)</option>
                  <option value="driver">Motorista</option>
                  <option value="admin">Gestor de Frota (Admin)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                <input 
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={newUser.displayName}
                  onChange={e => setNewUser({...newUser, displayName: e.target.value})}
                  placeholder="ex: João Silva"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Utilizador</label>
                <input 
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                  placeholder="ex: jsilva"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Palavra-passe</label>
                <input 
                  type="password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                  placeholder="••••••••"
                />
              </div>
            </div>
            
            <div className="flex gap-4 mt-10">
              <button 
                onClick={() => setIsAdding(false)}
                className="flex-1 bg-slate-800 text-slate-400 font-bold py-4 rounded-2xl hover:bg-slate-700 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAdd}
                className="flex-1 bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-indigo-900/30 hover:bg-indigo-500 transition-all uppercase text-xs tracking-widest"
              >
                Atribuir Acesso
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
