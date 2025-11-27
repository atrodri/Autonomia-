

import React, { useState, useCallback, useEffect } from 'react';
import type { Cycle, HistoryEvent } from './types';
import CycleForm from './components/CycleForm';
import CycleView from './components/CycleView';
import HomeScreen from './components/HomeScreen';
import { Header } from './components/Header';
import ReportView from './components/ReportView';
import TripView from './components/TripView';
import { Modal } from './components/ui/Modal';
import { Button } from './components/ui/Button';
import SplashScreen from './components/SplashScreen';
import CopilotView from './components/CopilotView';
import UserSettingsModal from './components/UserSettingsModal';

// Firebase
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, orderBy, query, writeBatch, getDocs } from 'firebase/firestore';

// Auth Components
import AuthView from './components/AuthView';
import LoginView from './components/LoginView';
import RegisterView from './components/RegisterView';

// Helper para recalcular o estado do ciclo baseado no histórico completo
const recalculateCycleStateFromHistory = (initialCycleState: Omit<Cycle, 'history' | 'currentMileage' | 'fuelAmount'>, updatedHistory: HistoryEvent[]) => {
  const sortedHistory = [...updatedHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let newCurrentMileage = initialCycleState.initialMileage;
  let newFuelAmount = 0;
  let latestConsumption = initialCycleState.consumption || 0;
  
  for(const event of sortedHistory) {
    if (event.type === 'start') continue;
    
    // Safety check for value
    const eventValue = 'value' in event ? event.value || 0 : 0;

    if (event.type === 'checkpoint' || event.type === 'route' || event.type === 'finish') {
        newCurrentMileage = Math.max(newCurrentMileage, eventValue);
    } else if (event.type === 'refuel') {
      newFuelAmount += eventValue;
    } else if (event.type === 'consumption') {
        latestConsumption = eventValue;
    }
  }

  return {
    history: sortedHistory,
    currentMileage: newCurrentMileage,
    fuelAmount: newFuelAmount,
    consumption: latestConsumption
  };
};

type AppLoadState = 'loading' | 'loaded';
type AuthState = 'checking' | 'authenticated' | 'unauthenticated';
type AuthViewType = 'landing' | 'login' | 'register';

const App: React.FC = () => {
  const [appLoadState, setAppLoadState] = useState<AppLoadState>('loading');
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentAuthView, setCurrentAuthView] = useState<AuthViewType>('landing');
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Logic for Copilot Mode
  const [copilotSessionId, setCopilotSessionId] = useState<string | null>(null);

  const [cycles, setCycles] = useState<Cycle[]>([]);
  // Estado para armazenar o histórico completo do ciclo ATIVO (vindo das subcoleções)
  const [activeCycleHistory, setActiveCycleHistory] = useState<HistoryEvent[]>([]);
  
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get('sessionId');
      if (sessionId) {
          setCopilotSessionId(sessionId);
          setAppLoadState('loaded'); 
          return; 
      }

    const timer = setTimeout(() => {
      setAppLoadState('loaded');
    }, 3200); 
    
    return () => {
      clearTimeout(timer);
    };
  }, []);

  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [reportCycleId, setReportCycleId] = useState<string | null>(null);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        setAuthState('authenticated');
      } else {
        setCurrentUser(null);
        setCycles([]); 
        setActiveCycleId(null);
        setReportCycleId(null);
        setFirestoreError(null);
        setAuthState('unauthenticated');
        setCurrentAuthView('landing');
      }
    });
    return () => unsubscribe();
  }, []);
  
  // Listener para a lista de Ciclos (apenas o documento pai)
  useEffect(() => {
    if (currentUser?.uid) {
        setFirestoreError(null);
        const cyclesCollectionRef = collection(db, 'usuarios', currentUser.uid, 'ciclos');
        const q = query(cyclesCollectionRef, orderBy('startDate', 'desc'));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            setFirestoreError(null);
            const cyclesData = querySnapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                name: data.name || 'Ciclo sem nome',
                startDate: (data.startDate as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                finishDate: (data.finishDate as Timestamp)?.toDate().toISOString(),
                initialMileage: data.initialMileage ?? 0,
                currentMileage: data.currentMileage ?? 0,
                fuelAmount: data.fuelAmount ?? 0,
                consumption: data.consumption ?? 0,
                status: data.status || 'active',
                history: [] // O histórico será carregado sob demanda
              } as Cycle
            });
            setCycles(cyclesData);
        }, (error) => {
            if (error.code === 'permission-denied') {
                console.warn("Permission denied fetching cycles. Check security rules.");
                setFirestoreError("Permissão negada. Verifique suas Regras de Segurança do Firestore.");
            } else {
                console.error("Error fetching cycles: ", error);
                setFirestoreError("Ocorreu um erro ao carregar os ciclos.");
            }
        });

        return () => unsubscribe();
    }
  }, [currentUser]);


  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isTrackingRoute, setIsTrackingRoute] = useState<boolean>(false);
  const [cycleToDeleteId, setCycleToDeleteId] = useState<string | null>(null);
  
  // Estados para edição/exclusão (que agora são documentos em subcoleções)
  const [eventToEdit, setEventToEdit] = useState<HistoryEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<HistoryEvent | null>(null);
  const [routeToView, setRouteToView] = useState<HistoryEvent | null>(null);

  // Listener para Subcoleções do Ciclo Ativo
  useEffect(() => {
    if (!currentUser?.uid || (!activeCycleId && !reportCycleId)) {
        setActiveCycleHistory([]);
        return;
    }

    const targetCycleId = activeCycleId || reportCycleId;
    if (!targetCycleId) return;

    const basePath = `usuarios/${currentUser.uid}/ciclos/${targetCycleId}`;
    
    const handleError = (context: string) => (error: any) => {
        if (error.code === 'permission-denied') {
            console.warn(`Permission denied for ${context}. Please check Firestore rules.`);
            // A mensagem principal de erro já foi setada pelo listener de ciclos.
        } else {
            console.error(`Error fetching ${context}:`, error);
        }
    };

    // Escutar as 3 subcoleções com tratamento de erro
    const unsubAbastecimento = onSnapshot(collection(db, basePath, 'abastecimento'), 
        (snap) => updateHistoryState('refuel', snap),
        handleError('abastecimento')
    );
    const unsubCheckpoint = onSnapshot(collection(db, basePath, 'checkpoint'), 
        (snap) => updateHistoryState('checkpoint', snap),
        handleError('checkpoint')
    );
    const unsubConsumo = onSnapshot(collection(db, basePath, 'consumo'), 
        (snap) => updateHistoryState('consumption', snap),
        handleError('consumo')
    );

    // Armazenamento temporário para merge
    let historyMap: Record<string, HistoryEvent[]> = {
        refuel: [],
        checkpoint: [],
        consumption: []
    };

    const updateHistoryState = (type: string, snapshot: any) => {
        const events = snapshot.docs.map((doc: any) => {
            const data = doc.data();
            return {
                id: doc.id,
                type: data.type || type, // Se o tipo estiver salvo, usa, senão usa o da coleção
                ...data,
                date: (data.date as Timestamp)?.toDate().toISOString() || new Date().toISOString()
            };
        });
        
        historyMap[type] = events;
        
        // Merge e Sort
        const allEvents = [
            ...historyMap.refuel,
            ...historyMap.checkpoint,
            ...historyMap.consumption
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setActiveCycleHistory(allEvents);
    };

    return () => {
        unsubAbastecimento();
        unsubCheckpoint();
        unsubConsumo();
    };
  }, [currentUser, activeCycleId, reportCycleId]);

  // Merge do ciclo ativo com seu histórico carregado das subcoleções
  const activeCycle = cycles.find(c => c.id === activeCycleId);
  const activeCycleWithHistory = activeCycle ? {
      ...activeCycle,
      history: [
          { id: 'start', type: 'start', value: activeCycle.initialMileage, date: activeCycle.startDate } as HistoryEvent,
          ...activeCycleHistory
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  } : undefined;

  // Merge para relatório
  const reportCycleRaw = cycles.find(c => c.id === reportCycleId);
  const reportCycle = reportCycleRaw ? {
      ...reportCycleRaw,
      history: [
          { id: 'start', type: 'start', value: reportCycleRaw.initialMileage, date: reportCycleRaw.startDate } as HistoryEvent,
          ...activeCycleHistory
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  } : undefined;

  const cycleToDelete = cycles.find(c => c.id === cycleToDeleteId);
  const activeCycles = cycles.filter(c => c.status === 'active');
  const finishedCycles = cycles.filter(c => c.status === 'finished');
  
  const isHomeScreen = !isCreating && !activeCycle && !reportCycle && !isTrackingRoute && !routeToView;

  const handleStartCreation = () => {
    setIsCreating(true);
    setActiveCycleId(null);
    setReportCycleId(null);
    setIsTrackingRoute(false);
    setRouteToView(null);
  };
  const handleCancelCreation = () => setIsCreating(false);

  const handleSelectCycle = (id: string) => {
    setActiveCycleId(id);
    setReportCycleId(null);
    setIsCreating(false);
    setIsTrackingRoute(false);
    setRouteToView(null);
  };
  
  const handleSelectReport = (id: string) => {
    setReportCycleId(id);
    setActiveCycleId(null);
    setIsCreating(false);
    setIsTrackingRoute(false);
    setRouteToView(null);
  };

  const handleGoHome = useCallback(() => {
    setActiveCycleId(null);
    setReportCycleId(null);
    setIsCreating(false);
    setIsTrackingRoute(false);
    setRouteToView(null);
  }, []);

  const handleStartRoute = () => {
    setIsTrackingRoute(true);
  };

  const handleEndRoute = useCallback(() => {
    setIsTrackingRoute(false);
  }, []);

  const handleViewRoute = (event: HistoryEvent) => {
    if (event.type === 'route') {
      setRouteToView(event);
    }
  };

  const handleEndViewRoute = () => {
    setRouteToView(null);
  };

  // Funções de CRUD usando Subcoleções

  const handleCreateCycle = useCallback(async (cycleData: Omit<Cycle, 'id' | 'currentMileage' | 'history' | 'status' | 'fuelAmount' | 'consumption'> & { initialFuel?: number }) => {
    if (!currentUser) return;
    const { initialFuel, ...restCycleData } = cycleData;
    
    // Dados do documento pai
    const newCycleData = {
      ...restCycleData,
      startDate: Timestamp.fromDate(new Date(restCycleData.startDate)),
      currentMileage: restCycleData.initialMileage,
      fuelAmount: initialFuel || 0,
      consumption: 0,
      status: 'active',
    };

    try {
      const docRef = await addDoc(collection(db, 'usuarios', currentUser.uid, 'ciclos'), newCycleData);
      
      // Se houver combustível inicial, adiciona na subcoleção 'abastecimento'
      if (initialFuel && initialFuel > 0) {
          await addDoc(collection(db, 'usuarios', currentUser.uid, 'ciclos', docRef.id, 'abastecimento'), {
              type: 'refuel',
              value: initialFuel,
              date: Timestamp.fromDate(new Date(restCycleData.startDate))
          });
      }

      setIsCreating(false);
      setActiveCycleId(docRef.id);
    } catch(e) {
      console.error("Error adding cycle: ", e);
      alert("Ocorreu um erro ao criar o ciclo.");
    }
  }, [currentUser]);

  // Função auxiliar para atualizar os agregados no documento pai
  const updateParentAggregates = async (cycleId: string, history: HistoryEvent[]) => {
      if (!currentUser) return;
      const cycleRef = doc(db, 'usuarios', currentUser.uid, 'ciclos', cycleId);
      
      // Precisamos dos dados iniciais do ciclo para recalcular corretamente
      const currentCycle = cycles.find(c => c.id === cycleId);
      if (!currentCycle) return;
      
      const { initialMileage, name, startDate, status, id } = currentCycle;
      
      // Filtra o 'start' do cálculo pois ele é base
      const { currentMileage, fuelAmount, consumption } = recalculateCycleStateFromHistory(
          { initialMileage, name, startDate, status, id, consumption: currentCycle.consumption },
          history.filter(e => e.type !== 'start')
      );

      await updateDoc(cycleRef, {
          currentMileage,
          fuelAmount,
          consumption
      });
  };

  // Wrapper para adicionar documento e atualizar pai
  const addEventToSubcollection = async (collectionName: string, data: any) => {
      if (!currentUser || !activeCycleId || !activeCycleWithHistory) return;
      
      // 1. Adiciona na subcoleção
      const docRef = await addDoc(collection(db, 'usuarios', currentUser.uid, 'ciclos', activeCycleId, collectionName), {
          ...data,
          date: Timestamp.fromDate(new Date(data.date))
      });

      // 2. Calcula novo estado localmente para atualizar o pai imediatamente
      const newEvent = { ...data, type: data.type, id: docRef.id, date: new Date(data.date).toISOString() };
      const newHistory = [...activeCycleWithHistory.history, newEvent];
      await updateParentAggregates(activeCycleId, newHistory);
  };

  const handleAddCheckpoint = useCallback(async (newMileage: number, date: string) => {
    await addEventToSubcollection('checkpoint', { type: 'checkpoint', value: newMileage, date });
  }, [activeCycleWithHistory]);
  
  const handleAddRouteCheckpoint = useCallback(async (distance: number, date: string, routeData: { origin: any, destination: any, traveledPath: { lat: number; lng: number }[] }) => {
    if (!activeCycleWithHistory) return;
    const newMileage = (activeCycleWithHistory.currentMileage ?? 0) + distance;

    await addEventToSubcollection('checkpoint', { 
        type: 'route',
        value: newMileage,
        distanciaPercorrida: distance,
        date,
        origin: routeData.origin,
        destination: routeData.destination,
        traveledPath: routeData.traveledPath
    });
  }, [activeCycleWithHistory]);


  const handleRefuel = useCallback(async (data: { fuelAdded: number; date: string; pricePerLiter?: number; discount?: number; }) => {
    const payload: any = { type: 'refuel', value: data.fuelAdded, date: data.date };
    if (data.pricePerLiter) payload.pricePerLiter = data.pricePerLiter;
    if (data.discount) payload.discount = data.discount;
    
    await addEventToSubcollection('abastecimento', payload);
  }, [activeCycleWithHistory]);

  const handleUpdateConsumption = useCallback(async (newConsumption: number, date: string) => {
    await addEventToSubcollection('consumo', { type: 'consumption', value: newConsumption, date });
  }, [activeCycleWithHistory]);

  const handleFinishCycle = useCallback(async () => {
    if (!currentUser || !activeCycleId || !activeCycleWithHistory) return;
    
    const finishTimestamp = Timestamp.now();
    
    await addDoc(collection(db, 'usuarios', currentUser.uid, 'ciclos', activeCycleId, 'checkpoint'), {
        type: 'finish',
        value: activeCycleWithHistory.currentMileage,
        date: finishTimestamp
    });

    // Atualiza status e adiciona data de finalização no pai
    const cycleRef = doc(db, 'usuarios', currentUser.uid, 'ciclos', activeCycleId);
    await updateDoc(cycleRef, { 
      status: 'finished',
      finishDate: finishTimestamp 
    });
  }, [currentUser, activeCycleId, activeCycleWithHistory]);

  // DELETE CYCLE
  const handleRequestDeleteCycle = (id: string) => setCycleToDeleteId(id);
  const handleCancelDelete = () => setCycleToDeleteId(null);

  const handleConfirmDelete = async () => {
    if (!cycleToDeleteId || !currentUser) return;
    
    const cycleDocRef = doc(db, 'usuarios', currentUser.uid, 'ciclos', cycleToDeleteId);
    try {
      // Deletar subcoleções (requer múltiplas escritas)
      const batch = writeBatch(db);
      const subcollections = ['abastecimento', 'checkpoint', 'consumo'];
      for (const sub of subcollections) {
          const subcollectionRef = collection(db, cycleDocRef.path, sub);
          const snapshot = await getDocs(subcollectionRef); // Use getDocs for a one-time fetch
          snapshot.forEach(doc => batch.delete(doc.ref));
      }
      
      // Deletar o documento pai
      batch.delete(cycleDocRef);

      await batch.commit();

      if (activeCycleId === cycleToDeleteId) handleGoHome();
      setCycleToDeleteId(null);
    } catch(e) {
      console.error("Error deleting cycle: ", e);
      alert("Ocorreu um erro ao excluir o ciclo.");
    }
  };

  // EDIT / DELETE EVENT
  const handleStartEditEvent = (event: HistoryEvent) => setEventToEdit(event);
  const handleCancelEditEvent = () => setEventToEdit(null);

  const getCollectionNameByType = (type: string) => {
      if (type === 'refuel') return 'abastecimento';
      if (type === 'consumption') return 'consumo';
      if (type === 'checkpoint' || type === 'route' || type === 'finish') return 'checkpoint';
      return null;
  };

  const handleSaveEditEvent = async (updatedEvent: HistoryEvent) => {
    if (!currentUser || !activeCycleId || !activeCycleWithHistory) return;
    
    const collectionName = getCollectionNameByType(updatedEvent.type);
    if (!collectionName) return; 

    const eventRef = doc(db, 'usuarios', currentUser.uid, 'ciclos', activeCycleId, collectionName, updatedEvent.id);
    
    const payload: any = { ...updatedEvent, date: Timestamp.fromDate(new Date(updatedEvent.date)) };
    delete payload.id;
    
    if (updatedEvent.type === 'refuel') {
      const value = updatedEvent.value;
      const pricePerLiter = updatedEvent.pricePerLiter;
      const discount = updatedEvent.discount;

      if (isNaN(value) || value <= 0) {
        alert("Quantidade de combustível inválida.");
        return;
      }
      
      payload.value = value;
      payload.pricePerLiter = (pricePerLiter && !isNaN(pricePerLiter)) ? pricePerLiter : undefined;
      payload.discount = (discount && !isNaN(discount)) ? discount : undefined;
    }

    // Clean up undefined fields
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);


    await updateDoc(eventRef, payload);
    
    const newHistory = activeCycleWithHistory.history.map(e => e.id === updatedEvent.id ? updatedEvent : e);
    await updateParentAggregates(activeCycleId, newHistory);
    
    setEventToEdit(null);
  };

  const handleRequestDeleteEvent = (event: HistoryEvent) => setEventToDelete(event);
  const handleCancelDeleteEvent = () => setEventToDelete(null);

  const handleConfirmDeleteEvent = async () => {
    if (!currentUser || !activeCycleId || !eventToDelete || !activeCycleWithHistory) return;
    
    const collectionName = getCollectionNameByType(eventToDelete.type);
    if (collectionName) {
        const eventRef = doc(db, 'usuarios', currentUser.uid, 'ciclos', activeCycleId, collectionName, eventToDelete.id);
        await deleteDoc(eventRef);
        
        const newHistory = activeCycleWithHistory.history.filter(e => e.id !== eventToDelete.id);
        await updateParentAggregates(activeCycleId, newHistory);
    }
    setEventToDelete(null);
  };
  
  const renderContent = () => {
    if (isCreating) {
      return <CycleForm onSubmit={handleCreateCycle} onCancel={handleCancelCreation} />;
    }

    if (routeToView) {
        return <TripView onEndTrip={handleEndViewRoute} tripToView={routeToView} />;
    }
    
    if (isTrackingRoute && activeCycleWithHistory) {
      return <TripView cycle={activeCycleWithHistory} onEndTrip={handleEndRoute} onAddCheckpoint={handleAddRouteCheckpoint} />;
    }

    if (reportCycle) {
      return <ReportView cycle={reportCycle} onGoBack={handleGoHome} />;
    }

    if (activeCycleWithHistory) {
      return (
        <CycleView
          cycle={activeCycleWithHistory}
          onAddCheckpoint={handleAddCheckpoint}
          onRefuel={handleRefuel}
          onUpdateConsumption={handleUpdateConsumption}
          onFinishCycle={handleFinishCycle}
          onGoBack={handleGoHome}
          onStartRoute={handleStartRoute}
          onViewRoute={handleViewRoute}
          onStartEditEvent={handleStartEditEvent}
          eventToEdit={eventToEdit}
          onCancelEditEvent={handleCancelEditEvent}
          onSaveEditEvent={handleSaveEditEvent}
          onRequestDeleteEvent={handleRequestDeleteEvent}
        />
      );
    }
    
    return (
      <HomeScreen
        activeCycles={activeCycles}
        finishedCycles={finishedCycles}
        onNewCycleClick={handleStartCreation}
        onSelectCycle={handleSelectCycle}
        onSelectReport={handleSelectReport}
        onDeleteCycle={handleRequestDeleteCycle}
        showContent={appLoadState === 'loaded'}
        firestoreError={firestoreError}
      />
    );
  };

  if (copilotSessionId) {
      return <CopilotView sessionId={copilotSessionId} />;
  }
  
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#CFCFCF] flex flex-col relative overflow-hidden">
      {appLoadState === 'loading' && <SplashScreen />}

      {appLoadState === 'loaded' && (
        <>
            {authState === 'unauthenticated' ? (
                <div className="container mx-auto p-4 md:p-6 flex-grow flex items-center justify-center">
                    {currentAuthView === 'landing' && (
                        <AuthView 
                            onLoginClick={() => setCurrentAuthView('login')} 
                            onRegisterClick={() => setCurrentAuthView('register')} 
                        />
                    )}
                    {currentAuthView === 'login' && (
                        <LoginView 
                            onSwitchToRegister={() => setCurrentAuthView('register')}
                            onSuccess={() => {/* State change handled by onAuthStateChanged */}}
                        />
                    )}
                    {currentAuthView === 'register' && (
                        <RegisterView 
                            onSwitchToLogin={() => setCurrentAuthView('login')}
                            onCancel={() => setCurrentAuthView('landing')}
                        />
                    )}
                </div>
            ) : (
                <>
                    {isTrackingRoute || routeToView ? null : (
                        <Header 
                            userName={currentUser?.displayName} 
                            userPhotoURL={currentUser?.photoURL}
                            onOpenSettings={() => setIsSettingsModalOpen(true)}
                        />
                    )}
                    <main className={`container mx-auto p-4 md:p-6 flex-grow ${isHomeScreen ? 'flex items-center justify-center' : ''} ${isTrackingRoute || routeToView ? '!p-0 !max-w-none' : ''}`}>
                        {renderContent()}
                    </main>
                </>
            )}
        </>
      )}
      
      {currentUser && (
        <UserSettingsModal 
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            currentUser={currentUser}
        />
      )}

      <Modal isOpen={!!cycleToDelete} onClose={handleCancelDelete} title="Confirmar Exclusão">
        {cycleToDelete && (
          <div className="space-y-4">
            <p>Você tem certeza que deseja excluir o ciclo "{cycleToDelete.name}"?</p>
            <p className="text-sm text-[#888]">Esta ação é permanente e não poderá ser desfeita.</p>
            <div className="pt-2 flex gap-4 flex-col-reverse sm:flex-row">
              <Button variant="secondary" onClick={handleCancelDelete} className="w-full">Cancelar</Button>
              <Button variant="danger" onClick={handleConfirmDelete} className="w-full">Excluir</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={!!eventToDelete} onClose={handleCancelDeleteEvent} title="Confirmar Exclusão">
        {eventToDelete && (
          <div className="space-y-4">
            <p>Você tem certeza que deseja excluir este evento?</p>
            <p className="text-sm text-[#888]">Esta ação recalculará o estado do ciclo e não poderá ser desfeita.</p>
            <div className="pt-2 flex gap-4 flex-col-reverse sm:flex-row">
              <Button variant="secondary" onClick={handleCancelDeleteEvent} className="w-full">Cancelar</Button>
              <Button variant="danger" onClick={handleConfirmDeleteEvent} className="w-full">Excluir</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default App;
