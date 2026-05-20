import React, { useState, useEffect } from 'react';
import { Truck, Lock, User, Loader2, Building } from 'lucide-react';
import { motion } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { cn } from '../lib/utils';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { Company } from '../types';

interface LandingPageProps {
  onLogin: (username: string, pass: string) => Promise<void>;
  isLoggingIn: boolean;
}

export function LandingPage({ onLogin, isLoggingIn }: LandingPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [brandedCompany, setBrandedCompany] = useState<Company | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('c') || params.get('company');
    
    if (slug) {
      const q = query(collection(db, 'companies'), where('slug', '==', slug.toLowerCase()));
      getDocs(q).then(snap => {
        if (!snap.empty) {
          setBrandedCompany({ id: snap.docs[0].id, ...snap.docs[0].data() } as Company);
        }
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(username, password);
    } catch (err: any) {
      console.error('Login error:', err);
      let msg = err.code || err.message || 'Erro desconhecido';
      
      if (err.code === 'auth/operation-not-allowed') {
        msg = 'O login com E-mail/Senha não está ativado no Firebase Console. Por favor, ative-o em Authentication > Sign-in method.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Utilizador ou palavra-passe incorretos.';
      } else if (msg.includes('offline')) {
        msg = 'O cliente parece estar offline. Verifique a sua ligação à internet ou as definições do Firestore.';
      }
      
      alert(`Erro ao entrar: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const isProcessing = isLoggingIn || loading;

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-indigo-600 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-purple-600 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl">
          <div className="text-center mb-8">
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg overflow-hidden border border-slate-700",
              brandedCompany?.logoUrl ? "bg-slate-800" : "bg-indigo-600 shadow-indigo-900/40"
            )}>
              {brandedCompany?.logoUrl ? (
                <img src={brandedCompany.logoUrl} alt={brandedCompany.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <Truck className="w-10 h-10 text-white" />
              )}
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              {brandedCompany?.name || 'FleetFlow Logistics'}
            </h1>
            <p className="text-slate-400 text-sm">
              {brandedCompany 
                ? `Portal de Acesso para Colaboradores e Motoristas`
                : 'Gestão Multifrotas e Otimização para Empresas Autorizadas'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Utilizador</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600"
                  placeholder="Seu utilizador"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Palavra-passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800/40 border border-slate-700/50 rounded-xl py-3 pl-10 pr-4 text-white focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isProcessing}
              className={cn(
                "w-full text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-4 uppercase text-xs tracking-widest",
                brandedCompany ? "bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/30" : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/30"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>A processar...</span>
                </>
              ) : (
                <span>Efectuar Login</span>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-[10px] text-slate-600">
              © 2026 {brandedCompany?.name || 'FleetFlow Logistics'}. Plataforma Restrita.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
