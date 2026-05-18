import React from 'react';
import { FileText, Download, Calendar, Truck } from 'lucide-react';

export function ReportsArea({ subTab, fuelPrices, tollRates }: any) {
  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Relatórios</h2>
          <p className="text-slate-400 text-sm">Extrate de atividade e custos</p>
        </div>
        <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all">
          <Download className="w-4 h-4" />
          Exportar PDF
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
           <FileText className="w-8 h-8 text-blue-500 mb-4" />
           <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Km este mês</p>
           <h4 className="text-2xl font-bold text-white">12.450 km</h4>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
           <Calendar className="w-8 h-8 text-green-500 mb-4" />
           <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Portagens</p>
           <h4 className="text-2xl font-bold text-white">450,20 €</h4>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-3xl">
           <Truck className="w-8 h-8 text-purple-500 mb-4" />
           <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Total Combustível Est.</p>
           <h4 className="text-2xl font-bold text-white">1.280,00 €</h4>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl h-64 flex items-center justify-center">
         <p className="text-slate-500 italic text-sm">Gráficos de atividade serão carregados aqui...</p>
      </div>
    </div>
  );
}
