
import React, { useMemo } from 'react';
import type { Cycle } from '../types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { ChevronRightIcon, FileTextIcon, TrashIcon } from './icons/Icons';

interface HomeScreenProps {
  activeCycles: Cycle[];
  finishedCycles: Cycle[];
  onNewCycleClick: () => void;
  onSelectCycle: (id: string) => void;
  onSelectReport: (id: string) => void;
  onDeleteCycle: (id: string) => void;
  showContent: boolean;
  firestoreError: string | null;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ activeCycles, finishedCycles, onNewCycleClick, onSelectCycle, onSelectReport, onDeleteCycle, showContent, firestoreError }) => {
  const numberFormatter = useMemo(() => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }), []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
  };

  return (
    <div className={`flex flex-col items-center text-center w-full transition-opacity duration-500 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
      <div className="mb-8 flex items-end justify-center">
         <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tighter">
          autonomia<span className="text-[#FF6B00]">+</span>
        </h1>
      </div>
      
      <div className="w-full">
        <div className="mb-6">
          <Button onClick={onNewCycleClick} className="px-6 py-2">
            Novo Ciclo
          </Button>
        </div>

        <div className="w-full max-w-2xl text-left">
          <h2 className="text-base font-semibold uppercase tracking-wider text-[#888] mb-3 px-1">Ciclos Ativos</h2>
          {firestoreError ? (
             <Card className="!p-6 text-center border border-dashed border-red-700 bg-red-900/20">
                <h3 className="text-lg font-bold text-red-400">Erro de Permissão do Firestore</h3>
                <p className="mt-2 text-red-300">O aplicativo não conseguiu carregar seus dados. Isso geralmente acontece porque as Regras de Segurança do seu banco de dados precisam ser configuradas.</p>
                <p className="mt-4 text-xs text-gray-400">Por favor, vá para o seu projeto no Console do Firebase, navegue até <strong>Firestore Database &gt; Regras</strong> e cole o seguinte código:</p>
                <pre className="mt-2 p-2 bg-black/50 text-left text-xs text-gray-300 rounded-md overflow-x-auto">
                    <code>
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{userId}/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}`}
                    </code>
                </pre>
                 <p className="mt-4 text-xs text-gray-400">Após publicar as novas regras, recarregue o aplicativo.</p>
            </Card>
          ) : activeCycles.length > 0 ? (
            <div className="space-y-3">
              {activeCycles.map(cycle => {
                const drivenKm = cycle.currentMileage - cycle.initialMileage;
                const initialAutonomy = cycle.fuelAmount * cycle.consumption;
                const remainingKm = Math.max(0, initialAutonomy - drivenKm);

                return (
                  <div 
                    key={cycle.id} 
                    className="bg-[#141414] rounded-lg p-4 shadow-md flex justify-between items-center"
                  >
                    <div>
                      <h3 className="font-bold text-white text-lg">{cycle.name}</h3>
                      <p className="text-sm text-[#FF6B00] font-semibold">
                        {numberFormatter.format(remainingKm)} km restantes
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="secondary" onClick={() => onSelectReport(cycle.id)} className="!p-2" title="Ver Relatório">
                          <FileTextIcon className="w-8 h-8 flex-shrink-0" />
                      </Button>
                      <Button variant="secondary" onClick={() => onSelectCycle(cycle.id)} className="!p-2" title="Ver Detalhes">
                          <ChevronRightIcon className="w-8 h-8 flex-shrink-0" />
                      </Button>
                      <button onClick={() => onDeleteCycle(cycle.id)} className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[#141414]" title="Excluir Ciclo">
                          <TrashIcon className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Card className="!p-6 text-center border border-dashed border-[#444]">
              <p className="text-[#CFCFCF] leading-tight">
                Nenhum ciclo ativo no momento. <br/>
                Clique em "Novo Ciclo" para começar a monitorar sua autonomia.
              </p>
            </Card>
          )}
        </div>

        {finishedCycles.length > 0 && (
          <div className="w-full max-w-2xl text-left mt-6">
            <h2 className="text-base font-semibold uppercase tracking-wider text-[#888] mb-3 px-1">Ciclos Finalizados</h2>
             <div className="space-y-3">
              {finishedCycles.map(cycle => (
                <div key={cycle.id} className="bg-[#141414] rounded-lg p-4 shadow-md flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-white text-lg">{cycle.name}</h3>
                    {cycle.finishDate && (
                      <p className="text-sm text-[#888]">
                        Finalizado em {formatDate(cycle.finishDate)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                      <Button variant="secondary" onClick={() => onSelectReport(cycle.id)} className="!p-2" title="Ver Relatório">
                      <FileTextIcon className="w-8 h-8 flex-shrink-0" />
                      </Button>
                      <button onClick={() => onDeleteCycle(cycle.id)} className="text-gray-500 hover:text-red-500 transition-colors p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[#141414]" title="Excluir Ciclo">
                          <TrashIcon className="w-6 h-6" />
                      </button>
                  </div>
                </div>
              ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeScreen;
