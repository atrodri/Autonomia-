import React, { useMemo } from 'react';
import type { Cycle } from '../types';
import { Card } from './ui/Card';
import { ChevronLeftIcon } from './icons/Icons';

interface ReportViewProps {
  cycle: Cycle;
  onGoBack: () => void;
}

const ReportView: React.FC<ReportViewProps> = ({ cycle, onGoBack }) => {
  const isOngoing = cycle.status === 'active';

  const reportData = useMemo(() => {
    const startDate = new Date(cycle.startDate);
    const lastEventDate = cycle.history.length > 0 ? new Date(cycle.history[cycle.history.length - 1].date) : startDate;
    
    const durationInMs = lastEventDate.getTime() - startDate.getTime();
    const durationInDays = Math.max(1, Math.ceil(durationInMs / (1000 * 60 * 60 * 24)));

    const totalDistance = cycle.currentMileage - cycle.initialMileage;
    
    const refuelEvents = cycle.history.filter(e => e.type === 'refuel');
    const totalCost = refuelEvents.reduce((acc, event) => {
        if (event.type === 'refuel' && event.pricePerLiter) {
            const cost = event.value * event.pricePerLiter - (event.discount || 0);
            return acc + cost;
        }
        return acc;
    }, 0);

    const costPerKm = totalDistance > 0 ? totalCost / totalDistance : 0;
    
    return {
      startDate,
      lastEventDate,
      durationInDays,
      totalDistance,
      totalCost,
      costPerKm,
      finalConsumption: cycle.consumption,
    };
  }, [cycle]);

  const {
    startDate,
    lastEventDate,
    durationInDays,
    totalDistance,
    totalCost,
    costPerKm,
    finalConsumption,
  } = reportData;
  
  const formatDate = (date: Date, isUtc: boolean = false) => {
    const options: Intl.DateTimeFormatOptions = {
        day: '2-digit', month: '2-digit', year: 'numeric'
    };
    if (isUtc) {
        options.timeZone = 'UTC';
    }
    return date.toLocaleDateString('pt-BR', options);
  };

  const numberFormatter = (value: number, options: Intl.NumberFormatOptions = {}) => 
    new Intl.NumberFormat('pt-BR', options).format(value);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-4">
        <button onClick={onGoBack} className="text-[#FF6B00] hover:text-[#ff852b] transition-colors flex items-center text-sm">
          <ChevronLeftIcon className="w-8 h-8 mr-1" />
          Voltar para Início
        </button>
      </div>

      <Card className="w-full">
        <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-white">{cycle.name}</h2>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${isOngoing ? 'bg-green-900 text-green-300 border border-green-700' : 'bg-[#2a2a2a] text-[#888] border border-[#444]'}`}>
                {isOngoing ? 'Ativo' : 'Finalizado'}
              </span>
            </div>
            <p className="text-sm text-[#CFCFCF]">Relatório de Desempenho do Ciclo</p>
        </div>

        <div className="space-y-6">
          {/* Resumo Geral */}
          <div>
            <h3 className="text-lg font-semibold text-[#FF6B00] mb-3 border-b border-[#2a2a2a] pb-2">Resumo Geral</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-[#CFCFCF] uppercase tracking-wider">Período</p>
                <p className="text-lg font-semibold text-white">
                  {formatDate(startDate, true)} - {formatDate(lastEventDate)}
                </p>
              </div>
              <div>
                <p className="text-sm text-[#CFCFCF] uppercase tracking-wider">Distância Total</p>
                <p className="text-lg font-semibold text-white">{numberFormatter(totalDistance, { maximumFractionDigits: 1 })} km</p>
              </div>
              <div>
                <p className="text-sm text-[#CFCFCF] uppercase tracking-wider">Duração</p>
                <p className="text-lg font-semibold text-white">{durationInDays} dia{durationInDays > 1 ? 's' : ''}</p>
                {isOngoing && <p className="text-xs text-[#888]">(em andamento)</p>}
              </div>
            </div>
          </div>
          
          {/* Análise de Custos */}
          <div>
            <h3 className="text-lg font-semibold text-[#FF6B00] mb-3 border-b border-[#2a2a2a] pb-2">Análise de Custos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-sm text-[#CFCFCF] uppercase tracking-wider">Custo Total</p>
                <p className="text-lg font-semibold text-white">{numberFormatter(totalCost, { style: 'currency', currency: 'BRL' })}</p>
              </div>
               <div>
                <p className="text-sm text-[#CFCFCF] uppercase tracking-wider">Custo / KM</p>
                <p className="text-lg font-semibold text-white">{numberFormatter(costPerKm, { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          {/* Análise de Desempenho */}
          <div>
            <h3 className="text-lg font-semibold text-[#FF6B00] mb-3 border-b border-[#2a2a2a] pb-2">Análise de Desempenho</h3>
            <div className="grid grid-cols-1 gap-4 text-center">
              <div>
                <p className="text-sm text-[#CFCFCF] uppercase tracking-wider">Consumo {isOngoing ? 'Atual' : 'Final'}</p>
                <p className="text-lg font-semibold text-white">{numberFormatter(finalConsumption, { maximumFractionDigits: 1 })} km/l</p>
              </div>
            </div>
          </div>

        </div>
      </Card>
    </div>
  );
};

export default ReportView;