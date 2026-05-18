import React, { useState } from 'react';
import { Truck, Lock, User, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface LandingPageProps {
  onLogin: (username: string, pass: string) => Promise<void>;
  isLoggingIn: boolean;
}

export function LandingPage({ onLogin, isLoggingIn }: LandingPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(username, password);
    } catch (err: any) {
      console.error('Login error:', err);
      const msg = err.code || err.message || 'Erro desconhecido';
      alert(`Erro ao entrar: ${msg}. Verifique o utilizador e palavra-passe.`);
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
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-900/40">
              <Truck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">FleetFlow Logistics</h1>
            <p className="text-slate-400 text-sm">
              Gestão Multifrotas e Otimização para Empresas Autorizadas
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
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-900/30 transition-all flex items-center justify-center gap-2 mt-4 uppercase text-xs tracking-widest"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>A processar...</span>
                </>
              ) : (
                <span>Entrar no Sistema</span>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-[10px] text-slate-600">
              © 2026 FleetFlow Logistics. Plataforma Restrita para Empresas Autorizadas.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
