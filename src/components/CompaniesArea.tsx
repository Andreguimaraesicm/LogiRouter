import React, { useState, useEffect } from 'react';
import { Building, Plus, Trash2, Shield, UserPlus, X, Briefcase } from 'lucide-react';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Company, Role } from '../types';
import { useAuth } from '../lib/AuthContext';
import { motion, AnimatePresence } from 'motion/react';

export function CompaniesArea() {
  const { register } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [newCompany, setNewCompany] = useState({ 
    name: '',
    adminUsername: '',
    adminPassword: '',
    adminDisplayName: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'companies'), snap => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleAdd = async () => {
    if (!newCompany.name || !newCompany.adminUsername || !newCompany.adminPassword) return;
    
    try {
      const companyId = `comp_${Math.random().toString(36).substr(2, 9)}`;
      
      // 1. Create the Admin User in Auth and Firestore
      // We do this first because we want the UID for the company document
      // Note: register uses adminAuth internally to avoid logging out current user
      await register(newCompany.adminUsername, newCompany.adminPassword, {
        displayName: newCompany.adminDisplayName || newCompany.adminUsername,
        role: 'admin',
        companyId: companyId
      });

      // 2. Create Company document
      await setDoc(doc(db, 'companies', companyId), {
        name: newCompany.name,
        adminId: newCompany.adminUsername, // We'll keep username as adminId for now to match UI, or we could find UID
        createdAt: new Date().toISOString()
      });
      
      setIsAdding(false);
      setNewCompany({ name: '', adminUsername: '', adminPassword: '', adminDisplayName: '' });
      alert('Empresa e Administrador criados com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao criar empresa: ${err.message || 'Erro desconhecido'}`);
    }
  };

  if (loading) return <div className="p-8 text-slate-500">A carregar empresas...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight uppercase">Gestão de Empresas</h2>
          <p className="text-slate-500">Registo de novos inquilinos na plataforma</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-xl shadow-cyan-900/20 font-bold text-sm"
        >
          <Plus className="w-5 h-5" />
          Nova Empresa
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {companies.map(company => (
          <div key={company.id} className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2rem] hover:border-cyan-500/30 transition-all group">
             <div className="flex items-start justify-between mb-6">
                <div className="p-4 bg-cyan-600/20 text-cyan-400 rounded-2xl group-hover:bg-cyan-600 group-hover:text-white transition-all">
                   <Building className="w-8 h-8" />
                </div>
                <button 
                  onClick={async () => {
                    if(confirm('Apagar empresa e todos os seus dados associados?')) await deleteDoc(doc(db, 'companies', company.id));
                  }}
                  className="text-slate-800 hover:text-rose-500 transition-colors p-2"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
             </div>
             <h3 className="text-xl font-bold text-white mb-1">{company.name}</h3>
             <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-4">ID: {company.id}</p>
             
             <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div>
                   <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Administrador</p>
                   <p className="text-xs text-white font-bold">@{company.adminId}</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
             </div>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] w-full max-w-md shadow-3xl relative"
          >
            <button onClick={() => setIsAdding(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-cyan-600 rounded-2xl">
                <Building className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Registar Empresa</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome da Empresa</label>
                <input 
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-bold"
                  value={newCompany.name}
                  onChange={e => setNewCompany({...newCompany, name: e.target.value})}
                  placeholder="Ex: Transportes ABC"
                />
              </div>

              <div className="pt-4 border-t border-slate-800">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-4">Credenciais do Administrador</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Utilizador</label>
                    <input 
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                      value={newCompany.adminUsername}
                      onChange={e => setNewCompany({...newCompany, adminUsername: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Palavra-passe</label>
                    <input 
                      type="password"
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
                      value={newCompany.adminPassword}
                      onChange={e => setNewCompany({...newCompany, adminPassword: e.target.value})}
                    />
                  </div>
                </div>
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
                className="flex-1 bg-cyan-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-cyan-900/30 hover:bg-cyan-500 transition-all uppercase text-xs tracking-[0.2em]"
              >
                Criar Acesso
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
