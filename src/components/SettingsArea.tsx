import React, { useState } from 'react';
import { Settings, Save, Fuel, CreditCard, Loader2 } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SettingsAreaProps {
  currentFuelPrices: any;
  currentTollRates: any;
}

export function SettingsArea({ currentFuelPrices, currentTollRates }: SettingsAreaProps) {
  const [fuel, setFuel] = useState(currentFuelPrices);
  const [tolls, setTolls] = useState(currentTollRates);
  const [saving, setSaving] = useState(false);

  // Update local state when global settings are loaded from Firestore
  React.useEffect(() => {
    if (currentFuelPrices) setFuel(currentFuelPrices);
    if (currentTollRates) setTolls(currentTollRates);
  }, [currentFuelPrices, currentTollRates]);

  const handleSave = async () => {
    if (!fuel || !tolls) {
      alert('Dados de configuração inválidos.');
      return;
    }
    setSaving(true);
    console.log('Iniciando salvamento de configurações:', { fuel, tolls });
    try {
      const docRef = doc(db, 'settings', 'global');
      await setDoc(docRef, {
        fuelPrices: fuel,
        tollRates: tolls
      }, { merge: true });
      console.log('Configurações salvas com sucesso!');
      alert('Configurações guardadas com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar as configurações:', error);
      alert(`Erro ao guardar configurações: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Configurações Globais</h2>
        <p className="text-slate-400 text-sm">Ajuste os parâmetros de cálculo do sistema</p>
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
