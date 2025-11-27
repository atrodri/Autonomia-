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
  onStartRoute: () => void;
  onViewRoute: (event: HistoryEvent) => void;
  onStartEditEvent: (event: HistoryEvent) => void;
  eventToEdit: HistoryEvent | null;
  onCancelEditEvent: () => void;
  onSaveEditEvent: (event: HistoryEvent) => void;
  onRequestDeleteEvent: (event: HistoryEvent) => void;
}

const getCurrentDateISO = () => {
    return new Date().toISOString().split('T')[0];
};


const formatKilometerInput = (value: string): string => {
  if (!value) return '';
  const numericValue = value.replace(/\D/g, '');
  if (!numericValue) return '';
  return new Intl.NumberFormat('pt-BR').format(parseInt(numericValue, 10));
};

const parseKilometerInput = (formattedValue: string): number => {
  if (!formattedValue) return 0;
  return parseInt(formattedValue.replace(/\./g, ''), 10);
};

const HistoryItem: React.FC<{ event: HistoryEvent; onEdit: (event: HistoryEvent) => void; onDelete: (event: HistoryEvent) => void; onViewRoute: (event: HistoryEvent) => void; }> = ({ event, onEdit, onDelete, onViewRoute }) => {
  const isEditable = event.type === 'checkpoint' || event.type === 'refuel' || event.type === 'consumption';
  const isViewable = event.type === 'route';
  const isDeletable = event.type === 'checkpoint' || event.type === 'refuel' || event.type === 'route' || event.type === 'consumption';
  const isClickable = isEditable || isViewable;
  
  const getDescription = () => {
    switch (event.type) {
      case 'start':
        return `Início do ciclo em ${(event.value ?? 0).toLocaleString('pt-BR')} km`;
      case 'checkpoint':
        return `Checkpoint em ${(event.value ?? 0).toLocaleString('pt-BR')} km`;
      case 'refuel':
        let desc = `Abastecimento de ${(event.value ?? 0).toLocaleString('pt-BR')} L`;
        if (event.pricePerLiter) {
          desc += ` (R$ ${event.pricePerLiter.toFixed(2)}/L)`;
        }
        if (event.discount) {
          desc += ` - Desconto: R$ ${event.discount.toFixed(2)}`;
        }
        return desc;
      case 'consumption':
        return `Consumo atualizado para ${(event.value ?? 0).toLocaleString('pt-BR')} km/L`;
      case 'finish':
        return `Ciclo finalizado em ${(event.value ?? 0).toLocaleString('pt-BR')} km`;
      case 'route':
        const distancia = 'distanciaPercorrida' in event ? event.distanciaPercorrida : 0;
        return `Rota concluída: +${(distancia ?? 0).toLocaleString('pt-BR', {maximumFractionDigits: 1})} km`;
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
      case 'route':
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
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC'
    });
  };

  const handleClick = () => {
    if (isEditable) onEdit(event);
    else if (isViewable) onViewRoute(event);
  };

  return (
    <div 
      className={`group flex items-start space-x-4 py-3 border-b border-[#2a2a2a] last:border-b-0 ${isClickable ? 'hover:bg-[#1f1f1f] rounded-md -mx-2 px-2' : ''}`}
    >
      <div className="flex-shrink-0 mt-1">{getIcon()}</div>
      <div 
        className={`flex-grow ${isClickable ? 'cursor-pointer' : ''}`}
        onClick={handleClick}
      >
        <p className="text-white text-sm">{getDescription()}</p>
        <p className="text-xs text-[#888]">{formatHistoryDate(event.date)}</p>
      </div>
      {(isEditable || isDeletable) && (
        <div className="flex-shrink-0 mt-1 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {isEditable && 
                <button onClick={() => onEdit(event)} title="Editar Evento" className="text-gray-400 hover:text-white">
                    <EditIcon className="w-5 h-5" />
                </button>
            }
            {isDeletable &&
                <button onClick={() => onDelete(event)} title="Excluir Evento" className="text-gray-400 hover:text-red-500">
                    <TrashIcon className="w-5 h-5" />
                </button>
            }
        </div>
      )}
      {isViewable && !isEditable && (
         <div className="flex-shrink-0 mt-1 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-xs text-[#FF6B00]" onClick={handleClick}>Ver Rota</p>
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
    const [date, setDate] = useState('');
    const [value, setValue] = useState('');
    const [price, setPrice] = useState('');
    const [discount, setDiscount] = useState('');

    useEffect(() => {
        if (event) {
            const dateForInput = new Date(event.date).toISOString().split('T')[0];
            setDate(dateForInput);
            
            // Fix: Use switch statement for better type narrowing.
            switch(event.type) {
                case 'checkpoint':
                    setValue(formatKilometerInput((event.value ?? 0).toString()));
                    break;
                case 'consumption':
                    setValue((event.value ?? 0).toString());
                    break;
                case 'refuel':
                    setValue((event.value ?? 0).toString());
                    setPrice((event.pricePerLiter ?? '').toString());
                    setDiscount((event.discount ?? '').toString());
                    break;
            }
        }
    }, [event]);
    
    const handleSave = () => {
      if (!event) return;
        let updatedEvent: HistoryEvent = { ...event, date: new Date(date).toISOString() };

        if (updatedEvent.type === 'checkpoint' || updatedEvent.type === 'consumption') {
            const parsedValue = updatedEvent.type === 'checkpoint' ? parseKilometerInput(value) : parseFloat(value);
            if (!isNaN(parsedValue)) {
                updatedEvent.value = parsedValue;
            }
        } else if (updatedEvent.type === 'refuel') {
            const parsedValue = parseFloat(value);
            const parsedPrice = parseFloat(price);
            const parsedDiscount = parseFloat(discount);

            if (!isNaN(parsedValue)) {
                updatedEvent.value = parsedValue;
            }
            updatedEvent.pricePerLiter = !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined;
            updatedEvent.discount = !isNaN(parsedDiscount) && parsedDiscount > 0 ? parsedDiscount : undefined;
        }

        onSave(updatedEvent);
    };
    
    return (
        <Modal isOpen={!!event} onClose={onClose} title={`Editar ${event.type}`}>
            <div className="space-y-4">
                <Input id="edit-date" label="Data" type="date" value={date} onChange={e => setDate(e.target.value)} />
                {event.type === 'checkpoint' && (
                    <Input id="edit-checkpoint-value" label="Quilometragem (km)" type="text" inputMode="numeric" value={value} onChange={e => setValue(formatKilometerInput(e.target.value))} />
                )}
                {event.type === 'consumption' && (
                     <Input id="edit-consumption-value" label="Consumo (km/l)" type="number" value={value} onChange={e => setValue(e.target.value)} />
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

const CycleView: React.FC<CycleViewProps> = ({ cycle, onAddCheckpoint, onRefuel, onUpdateConsumption, onFinishCycle, onGoBack, onStartRoute, onViewRoute, onStartEditEvent, eventToEdit, onCancelEditEvent, onSaveEditEvent, onRequestDeleteEvent }) => {
  const [isCheckpointModalOpen, setCheckpointModalOpen] = useState(false);
  const [isRefuelModalOpen, setRefuelModalOpen] = useState(false);
  const [isConsumptionModalOpen, setConsumptionModalOpen] = useState(false);
  const [isFinishConfirmModalOpen, setFinishConfirmModalOpen] = useState(false);
  
  const [newMileage, setNewMileage] = useState('');
  const [checkpointDate, setCheckpointDate] = useState(getCurrentDateISO());

  const [fuelAdded, setFuelAdded] = useState('');
  const [refuelDate, setRefuelDate] = useState(getCurrentDateISO());
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [discount, setDiscount] = useState('');

  const [newConsumption, setNewConsumption] = useState(cycle.consumption.toString());
  const [consumptionDate, setConsumptionDate] = useState(getCurrentDateISO());

  const isFinished = cycle.status === 'finished';
  const isReadyForAutonomy = (cycle.fuelAmount ?? 0) > 0 && (cycle.consumption ?? 0) > 0;

  const { maxReachableKm, remainingKm, remainingFuel } = useMemo(() => {
    if (!isReadyForAutonomy) {
      return { maxReachableKm: cycle.currentMileage ?? 0, remainingKm: 0, remainingFuel: 0 };
    }
    const drivenSinceStart = (cycle.currentMileage ?? 0) - (cycle.initialMileage ?? 0);
    let fuelConsumed = 0;
    if (cycle.consumption > 0) {
        fuelConsumed = drivenSinceStart / cycle.consumption;
    }
    const currentRemainingFuel = Math.max(0, (cycle.fuelAmount ?? 0) - fuelConsumed);
    const currentRemainingKm = currentRemainingFuel * (cycle.consumption ?? 0);
    const maxReachableKm = (cycle.currentMileage ?? 0) + currentRemainingKm;

    return { maxReachableKm, remainingKm: currentRemainingKm, remainingFuel: currentRemainingFuel };
  }, [cycle, isReadyForAutonomy]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }), []);
  const kmIntegerFormatter = useMemo(() => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }), []);


  const handleCheckpointSubmit = () => {
    const mileage = parseKilometerInput(newMileage);
    if (!isNaN(mileage) && mileage > (cycle.currentMileage ?? 0)) {
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
    setCheckpointDate(getCurrentDateISO());
    setCheckpointModalOpen(true);
  }
  const openRefuelModal = () => {
    setRefuelDate(getCurrentDateISO());
    setRefuelModalOpen(true);
  }
  const openConsumptionModal = () => {
    setConsumptionDate(getCurrentDateISO());
    setNewConsumption((cycle.consumption ?? 0) > 0 ? (cycle.consumption ?? 0).toString() : '');
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
                  {kmIntegerFormatter.format(remainingKm ?? 0)}
                  <span className="text-2xl font-normal ml-2">km</span>
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 gap-6 text-center mb-8">
                <div>
                  <p className="text-sm text-[#CFCFCF] uppercase tracking-wider">KM Atual</p>
                  <p className="text-xl font-semibold text-white">{kmIntegerFormatter.format(cycle.currentMileage ?? 0)} km</p>
                </div>
                <div>
                  <p className="text-sm text-[#CFCFCF] uppercase tracking-wider">Autonomia Máx.</p>
                  <p className="text-xl font-semibold text-white">{kmIntegerFormatter.format(maxReachableKm ?? 0)} km</p>
                </div>
                <div>
                  <p className="text-sm text-[#CFCFCF] uppercase tracking-wider">Saldo Combustível</p>
                  <p className="text-xl font-semibold text-white">{numberFormatter.format(remainingFuel ?? 0)} L</p>
                </div>
                <div>
                  <p className="text-sm text-[#CFCFCF] uppercase tracking-wider">Consumo</p>
                  <p className="text-xl font-semibold text-white">{numberFormatter.format(cycle.consumption ?? 0)} km/l</p>
                </div>
              </div>
            </>
          ) : (
             <div className="my-8 p-6 bg-[#0A0A0A] border border-dashed border-[#444] rounded-lg text-center">
              <h3 className="text-lg font-semibold text-[#FF6B00]">Vamos começar!</h3>
              <p className="mt-2 text-[#CFCFCF]">
                Para calcular a autonomia, precisamos de mais algumas informações.
              </p>
              <ul className="mt-4 text-left inline-block space-y-2 list-disc list-inside">
                {(cycle.fuelAmount ?? 0) <= 0 && (
                  <li className="text-sm">Use o botão <strong>Abastecer</strong> para registrar seu primeiro abastecimento.</li>
                )}
                {(cycle.consumption ?? 0) <= 0 && (
                   <li className="text-sm">Use o botão <strong>Atualizar Consumo</strong> para informar o consumo do veículo.</li>
                )}
              </ul>
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
            <Button variant="secondary" onClick={onStartRoute} disabled={isFinished}>
              <RouteIcon className="w-8 h-8 mr-2 flex-shrink-0" />
              Iniciar Rota
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
          {cycle.history.length > 1 ? ( // > 1 para ignorar o evento 'start'
            <div className="space-y-2">
              {[...cycle.history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((event) => {
                if (event.type === 'start') return null;
                return <HistoryItem key={event.id} event={event} onEdit={onStartEditEvent} onDelete={onRequestDeleteEvent} onViewRoute={onViewRoute} />
              })}
            </div>
          ) : (
            <p className="text-center text-[#888]">Nenhum evento registrado ainda.</p>
          )}
        </Card>
      </div>

      <Modal isOpen={isCheckpointModalOpen} onClose={() => setCheckpointModalOpen(false)} title="Adicionar Checkpoint">
        <div className="space-y-4">
          <Input
            label="Data"
            id="checkpointDate"
            type="date"
            value={checkpointDate}
            onChange={(e) => setCheckpointDate(e.target.value)}
          />
          <Input
            label="Nova Quilometragem (km)"
            id="newMileage"
            type="text"
            inputMode="numeric"
            value={newMileage}
            onChange={(e) => setNewMileage(formatKilometerInput(e.target.value))}
            placeholder={`Maior que ${(cycle.currentMileage ?? 0).toLocaleString('pt-BR')}`}
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
            label="Data"
            id="refuelDate"
            type="date"
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
            label="Data"
            id="consumptionDate"
            type="date"
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