import React from 'react';
import { Package, MapPin, Search } from 'lucide-react';

export function EmitterClientsArea() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Clientes e Emissores</h2>
          <p className="text-slate-400 text-sm">Base de dados de endereços frequentes</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-white text-sm outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Procurar cliente..."
          />
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-wider">
              <th className="px-6 py-4 font-bold">Cliente</th>
              <th className="px-6 py-4 font-bold">Endereço</th>
              <th className="px-6 py-4 font-bold">Última Visita</th>
              <th className="px-6 py-4 font-bold">Ações</th>
            </tr>
          </thead>
          <tbody className="text-sm text-slate-300">
            {[1,2,3].map(i => (
              <tr key={i} className="border-t border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                  <div className="p-2 bg-orange-900/20 text-orange-500 rounded-lg"><Package className="w-4 h-4" /></div>
                  Cliente Exemplo {i}
                </td>
                <td className="px-6 py-4 opacity-70">Rua da Logística, Lisboa</td>
                <td className="px-6 py-4 text-xs">15 Mai 2026</td>
                <td className="px-6 py-4">
                   <button className="text-blue-500 hover:underline">Ver no mapa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
