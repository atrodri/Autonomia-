import React, { useState, useMemo, useEffect } from 'react';
import type { Cycle, HistoryEvent } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { CheckpointIcon, FuelIcon, CarIcon, ChevronLeftIcon, FlagIcon, FinishFlagIcon, RouteIcon, EditIcon, TrashIcon } from './icons/Icons';

interface CycleViewProps {
  cycle: Cycle;
  onAddCheckpoint: (newMileage: number, date: string) => void;
  onRefuel: (data: { fuelAdded: number; date: string; pricePerLiter?: number; discount?: number; }) => void;
  onUpdateConsumption: (newConsumption: number, date: string) => void;
  onFinishCycle: () => void;
  onGoBack: () => void;
  onStartTrip: () => void;
  onStartEditEvent: (event: HistoryEvent) => void;
  eventToEdit: HistoryEvent | null;
  onCancelEditEvent: () => void;
  onSaveEditEvent: (event: HistoryEvent) => void;
  onRequestDeleteEvent: (event: HistoryEvent) => void;
}

const getCurrentDateTimeLocal = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

const HistoryItem: React.FC<{ event: HistoryEvent; onEdit: (event: HistoryEvent) => void; onDelete: (event: HistoryEvent) => void; }> = ({ event, onEdit, onDelete }) => {
  const isEditable = event.type === 'checkpoint' || event.type === 'refuel';

  const formatValue = (type: HistoryEvent['type'], value: number) => {
    switch (type) {
      case 'start':
      case 'checkpoint':
      case 'finish':
        return `${value.toLocaleString('pt-BR')} km`;
      case 'refuel':
        return `${value.toLocaleString('pt-BR')} L`;
      case 'consumption':
        return `${value.toLocaleString('pt-BR')} km/L`;
      case 'trip':
        return `+${value.toLocaleString('pt-BR', {maximumFractionDigits: 1})} km`;
    }
  };

  const getDescription = () => {
    switch (event.type) {
      case 'start':
        return `Início do ciclo em ${formatValue(event.type, event.value)}`;
      case 'checkpoint':
        return `Checkpoint em ${formatValue(event.type, event.value)}`;
      case 'refuel':
        let desc = `Abastecimento de ${formatValue(event.type, event.value)}`;
        if (event.pricePerLiter) {
          desc += ` (R$ ${event.pricePerLiter.toFixed(2)}/L)`;
        }
        if (event.discount) {
          desc += ` - Desconto: R$ ${event.discount.toFixed(2)}`;
        }
        return desc;
      case 'consumption':
        return `Consumo atualizado para ${formatValue(event.type, event.value)}`;
      case 'finish':
        return `Ciclo finalizado em ${formatValue(event.type, event.value)}`;
      case 'trip':
        return `Trajeto concluído: ${formatValue(event.type, event.value)}`;
      default:
        return '';
    }
  };

  const getIcon = () => {
    switch (event.type) {
      case 'start':
        return <FlagIcon className="w-8 h-8 text-[#FF6B00]" />;
      case 'checkpoint':
        return <CheckpointIcon className="w-8 h-8 text-blue-400" />;
      case 'trip':
        return <RouteIcon className="w-8 h-8 text-cyan-400" />;
      case 'refuel':
        return <FuelIcon className="w-8 h-8 text-green-400" />;
      case 'consumption':
        return <CarIcon className="w-8 h-8 text-purple-400" />;
      case 'finish':
        return <FinishFlagIcon className="w-8 h-8 text-red-500" />;
      default:
        return null;
    }
  };
  
  const formatHistoryDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
  };

  return (
    <div 
      className={`group flex items-start space-x-4 py-3 border-b border-[#2a2a2a] last:border-b-0 ${isEditable ? 'hover:bg-[#1f1f1f] rounded-md -mx-2 px-2' : ''}`}
    >
      <div className="flex-shrink-0 mt-1">{getIcon()}</div>
      <div 
        className={`flex-grow ${isEditable ? 'cursor-pointer' : ''}`}
        onClick={isEditable ? () => onEdit(event) : undefined}
      >
        <p className="text-white text-sm">{getDescription()}</p>
        <p className="text-xs text-[#888]">{formatHistoryDate(event.date)}</p>
      </div>
      {isEditable && (
        <div className="flex-shrink-0 mt-1 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(event)} title="Editar Evento" className="text-gray-400 hover:text-white">
                <EditIcon className="w-5 h-5" />
            </button>
            <button onClick={() => onDelete(event)} title="Excluir Evento" className="text-gray-400 hover:text-red-500">
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
      )}
    </div>
  );
};

const EditEventModal: React.FC<{
    event: HistoryEvent;
    onClose: () => void;
    onSave: (event: HistoryEvent) => void;
}> = ({ event, onClose, onSave }) => {
    const [date, setDate] = useState(new Date(event.date).toISOString().slice(0, 16));
    const [value, setValue] = useState(event.value.toString());
    const [price, setPrice] = useState(event.type === 'refuel' ? (event.pricePerLiter || '').toString() : '');
    const [discount, setDiscount] = useState(event.type === 'refuel' ? (event.discount || '').toString() : '');
    
    const handleSave = () => {
        if (event.type === 'checkpoint') {
            onSave({ 
                ...event, 
                date: new Date(date).toISOString(), 
                value: parseFloat(value) 
            });
        } else if (event.type === 'refuel') {
            onSave({ 
                ...event, 
                date: new Date(date).toISOString(),
                value: parseFloat(value), 
                pricePerLiter: price ? parseFloat(price) : undefined,
                discount: discount ? parseFloat(discount) : undefined
            });
        }
    };
    
    return (
        <Modal isOpen={!!event} onClose={onClose} title={`Editar ${event.type === 'checkpoint' ? 'Checkpoint' : 'Abastecimento'}`}>
            <div className="space-y-4">
                <Input id="edit-date" label="Data e Hora" type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
                {event.type === 'checkpoint' && (
                    <Input id="edit-checkpoint-value" label="Quilometragem (km)" type="number" value={value} onChange={e => setValue(e.target.value)} />
                )}
                {event.type === 'refuel' && (
                    <>
                        <Input id="edit-refuel-value" label="Combustível (litros)" type="number" value={value} onChange={e => setValue(e.target.value)} />
                        <Input id="edit-price" label="Preço por Litro (R$)" type="number" value={price} onChange={e => setPrice(e.target.value)} />
                        <Input id="edit-discount" label="Desconto (R$)" type="number" value={discount} onChange={e => setDiscount(e.target.value)} />
                    </>
                )}
                <div className="pt-2 flex gap-4">
                    <Button variant="secondary" onClick={onClose} className="w-full">Cancelar</Button>
                    <Button onClick={handleSave} className="w-full">Salvar</Button>
                </div>
            </div>
        </Modal>
    );
}

const CycleView: React.FC<CycleViewProps> = ({ cycle, onAddCheckpoint, onRefuel, onUpdateConsumption, onFinishCycle, onGoBack, onStartTrip, onStartEditEvent, eventToEdit, onCancelEditEvent, onSaveEditEvent, onRequestDeleteEvent }) => {
  const [isCheckpointModalOpen, setCheckpointModalOpen] = useState(false);
  const [isRefuelModalOpen, setRefuelModalOpen] = useState(false);
  const [isConsumptionModalOpen, setConsumptionModalOpen] = useState(false);
  const [isFinishConfirmModalOpen, setFinishConfirmModalOpen] = useState(false);
  
  const [newMileage, setNewMileage] = useState('');
  const [checkpointDate, setCheckpointDate] = useState(getCurrentDateTimeLocal());

  const [fuelAdded, setFuelAdded] = useState('');
  const [refuelDate, setRefuelDate] = useState(getCurrentDateTimeLocal());
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [discount, setDiscount] = useState('');

  const [newConsumption, setNewConsumption] = useState(cycle.consumption.toString());
  const [consumptionDate, setConsumptionDate] = useState(getCurrentDateTimeLocal());

  const isFinished = cycle.status === 'finished';
  const isReadyForAutonomy = cycle.fuelAmount > 0 && cycle.consumption > 0;

  const { maxReachableKm, remainingKm, remainingFuel } = useMemo(() => {
    if (!isReadyForAutonomy) {
      return { maxReachableKm: cycle.currentMileage, remainingKm: 0, remainingFuel: 0 };
    }
    const drivenSinceStart = cycle.currentMileage - cycle.initialMileage;
    let fuelConsumed = 0;
    if (cycle.consumption > 0) {
        fuelConsumed = drivenSinceStart / cycle.consumption;
    }
    const currentRemainingFuel = Math.max(0, cycle.fuelAmount - fuelConsumed);
    const currentRemainingKm = currentRemainingFuel * cycle.consumption;
    const maxReachableKm = cycle.currentMileage + currentRemainingKm;

    return { maxReachableKm, remainingKm: currentRemainingKm, remainingFuel: currentRemainingFuel };
  }, [cycle, isReadyForAutonomy]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }), []);

  const handleCheckpointSubmit = () => {
    const mileage = parseFloat(newMileage);
    if (!isNaN(mileage) && mileage > cycle.currentMileage) {
      onAddCheckpoint(mileage, new Date(checkpointDate).toISOString());
      setNewMileage('');
      setCheckpointModalOpen(false);
    } else {
      alert("Por favor, insira uma quilometragem válida e maior que a atual.");
    }
  };

  const handleRefuelSubmit = () => {
    const fuel = parseFloat(fuelAdded);
    const price = parseFloat(pricePerLiter);
    if (!isNaN(fuel) && fuel > 0 && !isNaN(price) && price > 0) {
      const disc = discount ? parseFloat(discount) : undefined;
      onRefuel({ 
        fuelAdded: fuel, 
        date: new Date(refuelDate).toISOString(), 
        pricePerLiter: price, 
        discount: disc 
      });
      setFuelAdded('');
      setPricePerLiter('');
      setDiscount('');
      setRefuelModalOpen(false);
    } else {
      alert("Por favor, insira valores válidos para combustível e preço por litro.");
    }
  };

  const handleConsumptionSubmit = () => {
    const consumption = parseFloat(newConsumption);
    if (!isNaN(consumption) && consumption > 0) {
      onUpdateConsumption(consumption, new Date(consumptionDate).toISOString());
      setConsumptionModalOpen(false);
    } else {
      alert("Por favor, insira um valor de consumo válido.");
    }
  };

  const handleConfirmFinish = () => {
    onFinishCycle();
    setFinishConfirmModalOpen(false);
  };

  const openCheckpointModal = () => {
    setCheckpointDate(getCurrentDateTimeLocal());
    setCheckpointModalOpen(true);
  }
  const openRefuelModal = () => {
    setRefuelDate(getCurrentDateTimeLocal());
    setRefuelModalOpen(true);
  }
  const openConsumptionModal = () => {
    setConsumptionDate(getCurrentDateTimeLocal());
    setNewConsumption(cycle.consumption > 0 ? cycle.consumption.toString() : '');
    setConsumptionModalOpen(true);
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC'
    });
  };

  return (
    <>
      <div className="w-full max-w-2xl mx-auto mb-4">
        <button onClick={onGoBack} className="text-[#FF6B00] hover:text-[#ff852b] transition-colors flex items-center text-sm">
          <ChevronLeftIcon className="w-8 h-8 mr-1" />
          Voltar para Início
        </button>
      </div>
      <Card className="w-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">{cycle.name}</h2>
          <p className="text-sm text-[#CFCFCF] mb-6">
            Iniciado em: {formatDate(cycle.startDate)}
          </p>

          {isReadyForAutonomy ? (
            <>
              <div className="mb-8">
                <p className="text-lg text-[#CFCFCF]">Quilometragem Restante</p>
                <p className="text-6xl font-bold text-[#FF6B00] tracking-tight">
                  {numberFormatter.format(remainingKm)}
                  <span className="text-2xl font-normal ml-2">km</span>
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 gap-6 text-center mb-8">
                <div>
                  <p className="text-sm text-[#CFCFCF] uppercase tracking-wider">KM Atual</p>
                  <p className="text-xl font-semibold text-white">{numberFormatter.format(cycle.currentMileage)} km</p>
                </div>
                <div>
                  <p className="text-sm text-[#CFCFCF] uppercase tracking-wider">Autonomia Máx.</p>
                  <p className="text-xl font-semibold text-white">{numberFormatter.format(maxReachableKm)} km</p>
                </div>
                <div>
                  <p className="text-sm text-[#CFCFCF] uppercase tracking-wider">Saldo Combustível</p>
                  <p className="text-xl font-semibold text-white">{numberFormatter.format(remainingFuel)} L</p>
                </div>
                <div>
                  <p className="text-sm text-[#CFCFCF] uppercase tracking-wider">Consumo</p>
                  <p className="text-xl font-semibold text-white">{numberFormatter.format(cycle.consumption)} km/l</p>
                </div>
              </div>
            </>
          ) : (
             <div className="my-8 p-6 bg-[#0A0A0A] border border-dashed border-[#444] rounded-lg text-center">
              <h3 className="text-lg font-semibold text-[#FF6B00]">Vamos começar!</h3>
              <p className="mt-2 text-[#CFCFCF]">
                Para calcular a autonomia, precisamos de mais algumas informações.
              </p>
              <div className="mt-4 text-left inline-block space-y-2">
                {cycle.fuelAmount <= 0 && (
                  <p className="text-sm">1. Use o botão <strong>Abastecer</strong> para registrar seu primeiro abastecimento.</p>
                )}
                {cycle.consumption <= 0 && (
                   <p className="text-sm">2. Use o botão <strong>Atualizar Consumo</strong> para informar o consumo do veículo.</p>
                )}
              </div>
            </div>
          )}


          <div className="grid grid-cols-2 gap-4 mb-4">
            <Button variant="secondary" onClick={openCheckpointModal} disabled={isFinished}>
              <CheckpointIcon className="w-8 h-8 mr-2 flex-shrink-0" />
              Checkpoint
            </Button>
            <Button variant="secondary" onClick={openRefuelModal} disabled={isFinished}>
              <FuelIcon className="w-8 h-8 mr-2 flex-shrink-0" />
              Abastecer
            </Button>
            <Button variant="secondary" onClick={openConsumptionModal} disabled={isFinished}>
              <CarIcon className="w-8 h-8 mr-2 flex-shrink-0" />
              Atualizar Consumo
            </Button>
            <Button variant="secondary" onClick={onStartTrip} disabled={isFinished}>
              <RouteIcon className="w-8 h-8 mr-2 flex-shrink-0" />
              Iniciar Trajeto
            </Button>
          </div>

          <div className="mt-6">
            <Button 
              variant={isFinished ? 'secondary' : 'danger'} 
              onClick={() => setFinishConfirmModalOpen(true)}
              className="w-full"
              disabled={isFinished}
            >
              {isFinished ? 'Ciclo Finalizado' : 'Finalizar Ciclo'}
            </Button>
          </div>
        </div>
      </Card>
      
      <div className="w-full mt-8">
        <h3 className="text-lg font-semibold text-white mb-4 text-center">Histórico do Ciclo</h3>
        <Card className="w-full !p-4 md:!p-6">
          {cycle.history.length > 0 ? (
            <div className="space-y-2">
              {[...cycle.history].reverse().map((event) => (
                <HistoryItem key={event.id} event={event} onEdit={onStartEditEvent} onDelete={onRequestDeleteEvent} />
              ))}
            </div>
          ) : (
            <p className="text-center text-[#888]">Nenhum evento registrado ainda.</p>
          )}
        </Card>
      </div>

      <Modal isOpen={isCheckpointModalOpen} onClose={() => setCheckpointModalOpen(false)} title="Adicionar Checkpoint">
        <div className="space-y-4">
          <Input
            label="Data e Hora"
            id="checkpointDate"
            type="datetime-local"
            value={checkpointDate}
            onChange={(e) => setCheckpointDate(e.target.value)}
          />
          <Input
            label="Nova Quilometragem (km)"
            id="newMileage"
            type="number"
            step="0.1"
            min={cycle.currentMileage + 0.1}
            value={newMileage}
            onChange={(e) => setNewMileage(e.target.value)}
            placeholder={`Maior que ${numberFormatter.format(cycle.currentMileage)}`}
          />
          <div className="pt-2 flex gap-4">
            <Button variant="secondary" onClick={() => setCheckpointModalOpen(false)} className="w-full">Cancelar</Button>
            <Button onClick={handleCheckpointSubmit} className="w-full">Adicionar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isRefuelModalOpen} onClose={() => setRefuelModalOpen(false)} title="Registrar Abastecimento">
        <div className="space-y-4">
          <Input
            label="Data e Hora"
            id="refuelDate"
            type="datetime-local"
            value={refuelDate}
            onChange={(e) => setRefuelDate(e.target.value)}
          />
          <Input
            label="Combustível Adicionado (litros)"
            id="fuelAdded"
            type="number"
            step="0.01"
            min="0.01"
            value={fuelAdded}
            onChange={(e) => setFuelAdded(e.target.value)}
            placeholder="Ex: 30.5"
            required
          />
          <Input
            label="Preço por Litro (R$)"
            id="pricePerLiter"
            type="number"
            step="0.01"
            min="0"
            value={pricePerLiter}
            onChange={(e) => setPricePerLiter(e.target.value)}
            placeholder="Ex: 5.89"
            required
          />
          <Input
            label="Desconto Total (R$, opcional)"
            id="discount"
            type="number"
            step="0.01"
            min="0"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            placeholder="Ex: 2.50"
          />
          <div className="pt-2 flex gap-4">
            <Button variant="secondary" onClick={() => setRefuelModalOpen(false)} className="w-full">Cancelar</Button>
            <Button onClick={handleRefuelSubmit} className="w-full">Adicionar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isConsumptionModalOpen} onClose={() => setConsumptionModalOpen(false)} title="Atualizar Consumo">
        <div className="space-y-4">
          <Input
            label="Data e Hora"
            id="consumptionDate"
            type="datetime-local"
            value={consumptionDate}
            onChange={(e) => setConsumptionDate(e.target.value)}
          />
          <Input
            label="Novo Consumo (km/l)"
            id="newConsumption"
            type="number"
            step="0.1"
            min="0.1"
            value={newConsumption}
            onChange={(e) => setNewConsumption(e.target.value)}
            placeholder="Ex: 13.2"
          />
          <div className="pt-2 flex gap-4">
            <Button variant="secondary" onClick={() => setConsumptionModalOpen(false)} className="w-full">Cancelar</Button>
            <Button onClick={handleConsumptionSubmit} className="w-full">Atualizar</Button>
          </div>
        </div>
      </Modal>
      
      <Modal isOpen={isFinishConfirmModalOpen} onClose={() => setFinishConfirmModalOpen(false)} title="Confirmar Finalização">
        <div className="space-y-4">
            <p>Você tem certeza que deseja finalizar o ciclo "{cycle.name}"?</p>
            <p className="text-sm text-[#888]">Esta ação não poderá ser desfeita.</p>
            <div className="pt-2 flex gap-4">
                <Button variant="danger" onClick={handleConfirmFinish} className="w-full">Confirmar</Button>
                <Button variant="secondary" onClick={() => setFinishConfirmModalOpen(false)} className="w-full">Cancelar</Button>
            </div>
        </div>
      </Modal>

      {eventToEdit && (
        <EditEventModal
            event={eventToEdit}
            onClose={onCancelEditEvent}
            onSave={onSaveEditEvent}
        />
      )}
    </>
  );
};

export default CycleView;