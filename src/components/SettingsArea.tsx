import React, { useState } from 'react';
import { Settings, Save, Fuel, CreditCard, Loader2, Globe, Building } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

interface SettingsAreaProps {
  currentFuelPrices: any;
  currentTollRates: any;
}

export function SettingsArea({ currentFuelPrices, currentTollRates }: SettingsAreaProps) {
  const { profile, isMaster } = useAuth();
  const [fuel, setFuel] = useState(currentFuelPrices);
  const [tolls, setTolls] = useState(currentTollRates);
  const [saving, setSaving] = useState(false);
  const [isGlobal, setIsGlobal] = useState(isMaster);

  React.useEffect(() => {
    if (currentFuelPrices) setFuel(currentFuelPrices);
    if (currentTollRates) setTolls(currentTollRates);
  }, [currentFuelPrices, currentTollRates]);

  const handleSave = async () => {
    if (!fuel || !tolls) return;
    const targetId = isGlobal && isMaster ? 'global' : profile?.companyId;
    if (!targetId) return;

    setSaving(true);
    try {
      const docRef = doc(db, 'settings', targetId);
      await setDoc(docRef, {
        fuelPrices: fuel,
        tollRates: tolls
      }, { merge: true });
      alert('Configurações guardadas com sucesso!');
    } catch (error: any) {
      alert(`Erro ao guardar configurações: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight uppercase tracking-[0.2em]">Configurações</h2>
          <p className="text-slate-500 text-sm">Parâmetros operacionais da {isGlobal ? 'Plataforma' : 'Empresa'}</p>
        </div>
        {isMaster && (
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-2xl">
            <button 
              onClick={() => setIsGlobal(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isGlobal ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Globe className="w-3.5 h-3.5" />
              Global
            </button>
            <button 
              onClick={() => setIsGlobal(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isGlobal ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Building className="w-3.5 h-3.5" />
              Empresa
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-900/20 text-indigo-500 rounded-lg">
              <Fuel className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Preços de Combustível (€/L - S/IVA)</h3>
          </div>
          
          <div className="space-y-4">
            {Object.entries(fuel).map(([key, val]: [string, any]) => (
              <div key={key} className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">{key}</label>
                <input 
                  type="number"
                  step="0.001"
                  value={val}
                  onChange={e => setFuel({...fuel, [key]: parseFloat(e.target.value)})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-900/20 text-indigo-500 rounded-lg">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Taxas de Portagem (€/Km - S/IVA)</h3>
          </div>
          
          <div className="space-y-4">
            {Object.entries(tolls).map(([key, val]: [string, any]) => (
              <div key={key} className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase ml-1">Classe {key}</label>
                <input 
                  type="number"
                  step="0.001"
                  value={val}
                  onChange={e => setTolls({...tolls, [key]: parseFloat(e.target.value)})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-900/20 disabled:bg-slate-800"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Guardar Alterações
        </button>
      </div>
    </div>
  );
}
