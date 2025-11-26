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
}

const HomeScreen: React.FC<HomeScreenProps> = ({ activeCycles, finishedCycles, onNewCycleClick, onSelectCycle, onSelectReport, onDeleteCycle }) => {
  const numberFormatter = useMemo(() => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }), []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
  };

  return (
    <div className="flex flex-col items-center text-center w-full">
      <div className="mb-8 flex items-end justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 md:h-14 md:w-14 text-[#FF6B00] mr-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="3"></circle>
            <line x1="12" y1="22" x2="12" y2="15"></line>
            <line x1="5.64" y1="5.64" x2="9.17" y2="9.17"></line>
            <line x1="18.36" y1="5.64" x2="14.83" y2="9.17"></line>
        </svg>
        <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight">
          Autonomia<span className="text-[#FF6B00]">+</span>
        </h1>
      </div>
      
      <div className="mb-6">
        <Button onClick={onNewCycleClick} className="px-6 py-2">
          Novo Ciclo
        </Button>
      </div>

      <div className="w-full max-w-2xl text-left">
        <h2 className="text-base font-semibold uppercase tracking-wider text-[#888] mb-3 px-1">Ciclos Ativos</h2>
        {activeCycles.length > 0 ? (
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
                  <p className="text-sm text-[#888]">
                    Finalizado em {formatDate(cycle.history[cycle.history.length - 1].date)}
                  </p>
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
  );
};

export default HomeScreen;