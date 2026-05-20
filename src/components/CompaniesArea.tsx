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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  const [newCompany, setNewCompany] = useState({ 
    name: '',
    slug: '',
    logoUrl: '',
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
    setFormError(null);
    const cleanName = newCompany.name.trim();
    const cleanSlug = newCompany.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const cleanUsername = newCompany.adminUsername.trim();
    const cleanPassword = newCompany.adminPassword;
    
    if (!cleanName || !cleanUsername || !cleanPassword || !cleanSlug) {
      setFormError('Por favor, preencha todos os campos obrigatórios (*).');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const companyId = `comp_${Math.random().toString(36).substr(2, 9)}`;
      
      // 1. Create the Admin User in Auth and Firestore
      await register(cleanUsername, cleanPassword, {
        displayName: newCompany.adminDisplayName.trim() || cleanUsername,
        role: 'admin',
        companyId: companyId,
        slug: cleanSlug
      });

      // 2. Create Company document
      await setDoc(doc(db, 'companies', companyId), {
        name: cleanName,
        slug: cleanSlug,
        logoUrl: newCompany.logoUrl,
        adminId: cleanUsername,
        createdAt: new Date().toISOString()
      });
      
      setIsAdding(false);
      setNewCompany({ name: '', slug: '', logoUrl: '', adminUsername: '', adminPassword: '', adminDisplayName: '' });
      alert('Empresa e Administrador criados com sucesso!');
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Erro de comunicação ao registar a empresa.');
    } finally {
      setIsSubmitting(false);
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
          onClick={() => {
            setFormError(null);
            setIsAdding(true);
          }}
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
             
             <div className="pt-4 border-t border-slate-800 flex items-center justify-between mt-auto">
                <div>
                   <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Portal da Empresa</p>
                   <a 
                     href={`${window.location.origin}?c=${company.slug}`} 
                     target="_blank" 
                     rel="noreferrer"
                     className="text-xs text-cyan-400 font-bold hover:underline break-all"
                   >
                     {company.slug}
                   </a>
                </div>
             </div>
             
             <div className="pt-4 border-t border-slate-800 flex items-center justify-between mt-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md overflow-y-auto">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] w-full max-w-md shadow-3xl relative my-8"
          >
            <button 
              onClick={() => {
                if (!isSubmitting) setIsAdding(false);
              }} 
              disabled={isSubmitting}
              className="absolute top-6 right-6 text-slate-500 hover:text-white disabled:opacity-30"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-cyan-600 rounded-2xl">
                <Building className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Registar Empresa</h3>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-2xl text-xs font-bold leading-relaxed mb-4">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome da Empresa *</label>
                <input 
                  disabled={isSubmitting}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-bold disabled:opacity-50"
                  value={newCompany.name}
                  onChange={e => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
                    setNewCompany({...newCompany, name, slug});
                  }}
                  placeholder="Ex: Transportes ABC"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Slug (Domínio) *</label>
                  <input 
                    disabled={isSubmitting}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-2 text-xs text-cyan-400 outline-none focus:ring-2 focus:ring-cyan-500 transition-all font-mono disabled:opacity-50"
                    value={newCompany.slug}
                    onChange={e => setNewCompany({...newCompany, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})}
                    placeholder="ex-transportes-abc"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Logo URL (Opcional)</label>
                  <input 
                    disabled={isSubmitting}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-cyan-500 transition-all disabled:opacity-50"
                    value={newCompany.logoUrl.startsWith('data:') ? 'Imagem carregada de ficheiro' : newCompany.logoUrl}
                    onChange={e => setNewCompany({...newCompany, logoUrl: e.target.value})}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Logótipo do Computador (Alternativo)</label>
                <div className="flex gap-4 items-center bg-slate-800/20 p-3 rounded-2xl border border-slate-800">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {newCompany.logoUrl ? (
                      <img src={newCompany.logoUrl} alt="Logo preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <Building className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="cursor-pointer inline-flex items-center gap-2 bg-slate-850 hover:bg-slate-750 text-white font-extrabold text-[10px] uppercase px-3 py-2 rounded-xl border border-slate-700 transition-all select-none">
                      <Plus className="w-3.5 h-3.5" />
                      Escolher Ficheiro
                      <input 
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 250 * 1024) {
                              setFormError('Escolha uma imagem menor do que 250KB para garantir excelente desempenho no carregamento.');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setNewCompany({ ...newCompany, logoUrl: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {newCompany.logoUrl && (
                      <button 
                        type="button" 
                        onClick={() => setNewCompany({ ...newCompany, logoUrl: '' })}
                        className="text-[10px] text-rose-500 hover:text-rose-400 font-extrabold uppercase mt-1 block hover:underline"
                      >
                        Limpar logótipo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-3">Credenciais do Administrador</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Utilizador *</label>
                    <input 
                      disabled={isSubmitting}
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-cyan-500 transition-all disabled:opacity-50"
                      value={newCompany.adminUsername}
                      onChange={e => setNewCompany({...newCompany, adminUsername: e.target.value})}
                      placeholder="Nome do admin"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Palavra-passe *</label>
                    <input 
                      disabled={isSubmitting}
                      type="password"
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-cyan-500 transition-all disabled:opacity-50"
                      value={newCompany.adminPassword}
                      onChange={e => setNewCompany({...newCompany, adminPassword: e.target.value})}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4 mt-8">
              <button 
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsAdding(false)}
                className="flex-1 bg-slate-800 text-slate-400 font-bold py-4 rounded-2xl hover:bg-slate-700 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={handleAdd}
                disabled={isSubmitting}
                className="flex-1 bg-cyan-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-cyan-900/30 hover:bg-cyan-500 transition-all uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    A criar...
                  </>
                ) : (
                  'Criar Acesso'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
