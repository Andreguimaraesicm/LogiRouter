import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Shield, Search } from 'lucide-react';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Role } from '../types';

export function UsersManagementArea() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({ 
    username: '', 
    displayName: '', 
    role: 'manager' as Role, 
    password: 'password123',
    email: '' 
  });

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });
  }, []);

  const handleAdd = async () => {
    if (!newUser.username || !newUser.displayName) return;
    await addDoc(collection(db, 'users'), newUser);
    setIsAdding(false);
    setNewUser({ username: '', displayName: '', role: 'manager', password: 'password123', email: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Utilizadores do Sistema</h2>
          <p className="text-slate-400 text-sm">Controle de acessos administrativos</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-red-900/20"
        >
          <Plus className="w-5 h-5" />
          Novo Administrador
        </button>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-wider">
              <th className="px-6 py-4 font-bold">Utilizador</th>
              <th className="px-6 py-4 font-bold">Cargo</th>
              <th className="px-6 py-4 font-bold">Email</th>
              <th className="px-6 py-4 font-bold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="text-sm text-slate-300">
            {users.map(user => (
              <tr key={user.uid} className="border-t border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-xs">
                      {user.username[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-white">{user.displayName || user.username}</p>
                      <p className="text-[10px] text-slate-500">@{user.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                    user.role === 'master' ? 'bg-red-900/20 text-red-500' : 
                    user.role === 'manager' ? 'bg-blue-900/20 text-blue-500' : 
                    'bg-green-900/20 text-green-500'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 opacity-70">{user.email || 'N/A'}</td>
                <td className="px-6 py-4 text-right">
                   <button 
                    onClick={async () => {
                      if(confirm('Remover acesso?')) await deleteDoc(doc(db, 'users', user.uid));
                    }}
                    className="text-slate-600 hover:text-red-500 transition-colors p-2"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6">Conceder Acesso</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Cargo</label>
                <select 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-red-500"
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value as Role})}
                >
                  <option value="manager">Manager</option>
                  <option value="master">Master (Privilégios Totais)</option>
                  <option value="driver">Motorista</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Nome de Exibição</label>
                <input 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-red-500"
                  value={newUser.displayName}
                  onChange={e => setNewUser({...newUser, displayName: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Utilizador (username)</label>
                <input 
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-red-500"
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Email</label>
                <input 
                  type="email"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-2 focus:ring-red-500"
                  value={newUser.email}
                  onChange={e => setNewUser({...newUser, email: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setIsAdding(false)}
                className="flex-1 bg-slate-800 text-white font-bold py-3 rounded-xl hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAdd}
                className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-red-500"
              >
                Atribuir Cargo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
