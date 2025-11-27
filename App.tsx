
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
// Fix: Use Firebase compat library to resolve import errors.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { auth, db } from './firebase';

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
// Fix: Define User type from firebase compat.
type User = firebase.User;

const App: React.FC = () => {
  const [appLoadState, setAppLoadState] = useState<AppLoadState>('loading');
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentAuthView, setCurrentAuthView] = useState<AuthViewType>('landing');
  const [firestoreError, setFirestoreError] = useState<string | null>(null);

  // Logic for Copilot Mode
  const [copilotSessionId, setCopilotSessionId] = useState<string | null>(null);

  const [cycles, setCycles] = useState<Cycle[]>([]);
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
    const unsubscribe = auth.onAuthStateChanged((user) => {
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
  
  // Listener for Cycles list
  useEffect(() => {
    if (currentUser?.uid) {
        setFirestoreError(null);
        const cyclesCollectionRef = db.collection('usuarios').doc(currentUser.uid).collection('ciclos');
        const q = cyclesCollectionRef.orderBy('startDate', 'desc');

        const unsubscribe = q.onSnapshot((querySnapshot) => {
            setFirestoreError(null);
            const cyclesData = querySnapshot.docs.map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                name: data.name || 'Ciclo sem nome',
                startDate: (data.startDate as firebase.firestore.Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                finishDate: (data.finishDate as firebase.firestore.Timestamp)?.toDate().toISOString(),
                initialMileage: data.initialMileage ?? 0,
                currentMileage: data.currentMileage ?? 0,
                fuelAmount: data.fuelAmount ?? 0,
                consumption: data.consumption ?? 0,
                status: data.status || 'active',
                history: [] // History is loaded on demand
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

  // States for subcollection listeners
  const [abastecimentoHistory, setAbastecimentoHistory] = useState<HistoryEvent[]>([]);
  const [checkpointHistory, setCheckpointHistory] = useState<HistoryEvent[]>([]);
  const [consumoHistory, setConsumoHistory] = useState<HistoryEvent[]>([]);

  // Listener for Active Cycle Subcollections
  useEffect(() => {
    const targetCycleId = activeCycleId || reportCycleId;
    if (!currentUser?.uid || !targetCycleId) {
        setActiveCycleHistory([]);
        setAbastecimentoHistory([]);
        setCheckpointHistory([]);
        setConsumoHistory([]);
        return;
    }

    const basePath = `usuarios/${currentUser.uid}/ciclos/${targetCycleId}`;
    
    const createListener = (subcollection: string, setter: React.Dispatch<React.SetStateAction<HistoryEvent[]>>) => {
        const handleError = (error: any) => {
            if (error.code === 'permission-denied') {
                console.warn(`Permission denied for ${subcollection}.`);
                setFirestoreError("Permissão negada. Verifique suas Regras de Segurança do Firestore.");
            } else {
                console.error(`Error fetching ${subcollection}:`, error);
            }
            setter([]); // Clear state on error
        };

        // FIX: basePath refers to a document. Use db.doc() to create a DocumentReference before accessing a subcollection.
        const subcollectionRef = db.doc(basePath).collection(subcollection);
        return subcollectionRef.onSnapshot((snap) => {
            const events = snap.docs.map((doc: any) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    date: (data.date as firebase.firestore.Timestamp)?.toDate().toISOString() || new Date().toISOString()
                };
            });
            setter(events as HistoryEvent[]);
        }, handleError);
    };

    const unsubAbastecimento = createListener('abastecimento', setAbastecimentoHistory);
    const unsubCheckpoint = createListener('checkpoint', setCheckpointHistory);
    const unsubConsumo = createListener('consumo', setConsumoHistory);

    return () => {
        unsubAbastecimento();
        unsubCheckpoint();
        unsubConsumo();
    };
  }, [currentUser, activeCycleId, reportCycleId]);
  
  // Merge histories when any of them change
  useEffect(() => {
    const allEvents = [...abastecimentoHistory, ...checkpointHistory, ...consumoHistory];
    setActiveCycleHistory(allEvents);
  }, [abastecimentoHistory, checkpointHistory, consumoHistory]);

  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isTrackingRoute, setIsTrackingRoute] = useState<boolean>(false);
  const [cycleToDeleteId, setCycleToDeleteId] = useState<string | null>(null);
  
  const [eventToEdit, setEventToEdit] = useState<HistoryEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<HistoryEvent | null>(null);
  const [routeToView, setRouteToView] = useState<HistoryEvent | null>(null);

  const activeCycle = cycles.find(c => c.id === activeCycleId);
  const activeCycleWithHistory = activeCycle ? {
      ...activeCycle,
      history: [
          { id: 'start', type: 'start', value: activeCycle.initialMileage, date: activeCycle.startDate } as HistoryEvent,
          ...activeCycleHistory
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  } : undefined;

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

  const handleCreateCycle = useCallback(async (cycleData: Omit<Cycle, 'id' | 'currentMileage' | 'history' | 'status' | 'fuelAmount' | 'consumption'> & { initialFuel?: number }) => {
    if (!currentUser) return;
    const { initialFuel, ...restCycleData } = cycleData;
    
    const newCycleData = {
      ...restCycleData,
      startDate: firebase.firestore.Timestamp.fromDate(new Date(restCycleData.startDate)),
      currentMileage: restCycleData.initialMileage,
      fuelAmount: initialFuel || 0,
      consumption: 0,
      status: 'active',
    };

    try {
      const docRef = await db.collection('usuarios').doc(currentUser.uid).collection('ciclos').add(newCycleData);
      
      if (initialFuel && initialFuel > 0) {
          await db.collection('usuarios').doc(currentUser.uid).collection('ciclos').doc(docRef.id).collection('abastecimento').add({
              type: 'refuel',
              value: initialFuel,
              date: firebase.firestore.Timestamp.fromDate(new Date(restCycleData.startDate))
          });
      }

      setIsCreating(false);
      setActiveCycleId(docRef.id);
    } catch(e) {
      console.error("Error adding cycle: ", e);
      alert("Ocorreu um erro ao criar o ciclo.");
    }
  }, [currentUser]);

  const updateParentAggregates = async (cycleId: string) => {
      if (!currentUser) return;
      
      const currentCycle = cycles.find(c => c.id === cycleId);
      if (!currentCycle) return;

      // Fetch all events again to ensure consistency
      const basePath = `usuarios/${currentUser.uid}/ciclos/${cycleId}`;
      // FIX: basePath refers to a document. Use db.doc() to create a DocumentReference before accessing a subcollection.
      const [abastecimentoSnap, checkpointSnap, consumoSnap] = await Promise.all([
          db.doc(basePath).collection('abastecimento').get(),
          db.doc(basePath).collection('checkpoint').get(),
          db.doc(basePath).collection('consumo').get()
      ]);
      
      const combinedHistory = [
          ...abastecimentoSnap.docs.map(d => ({...d.data(), id: d.id, date: (d.data().date as firebase.firestore.Timestamp).toDate().toISOString() })),
          ...checkpointSnap.docs.map(d => ({...d.data(), id: d.id, date: (d.data().date as firebase.firestore.Timestamp).toDate().toISOString() })),
          ...consumoSnap.docs.map(d => ({...d.data(), id: d.id, date: (d.data().date as firebase.firestore.Timestamp).toDate().toISOString() }))
      ] as HistoryEvent[];
      
      const { currentMileage, fuelAmount, consumption } = recalculateCycleStateFromHistory(
          currentCycle,
          combinedHistory
      );

      const cycleRef = db.collection('usuarios').doc(currentUser.uid).collection('ciclos').doc(cycleId);
      await cycleRef.update({
          currentMileage,
          fuelAmount,
          consumption
      });
  };

  const addEventToSubcollection = async (collectionName: string, data: any) => {
      if (!currentUser || !activeCycleId) return;
      await db.collection('usuarios').doc(currentUser.uid).collection('ciclos').doc(activeCycleId).collection(collectionName).add({
          ...data,
          date: firebase.firestore.Timestamp.fromDate(new Date(data.date))
      });
      await updateParentAggregates(activeCycleId);
  };

  const handleAddCheckpoint = useCallback(async (newMileage: number, date: string) => {
    await addEventToSubcollection('checkpoint', { type: 'checkpoint', value: newMileage, date });
  }, [activeCycleId, currentUser]);
  
  const handleAddRouteCheckpoint = useCallback(async (distance: number, date: string, routeData: { origin: any; destination: any; traveledPath: { lat: number; lng: number }[] }) => {
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
  }, [activeCycleWithHistory, currentUser]);


  const handleRefuel = useCallback(async (data: { fuelAdded: number; date: string; pricePerLiter?: number; discount?: number; }) => {
    const payload: any = { type: 'refuel', value: data.fuelAdded, date: data.date };
    if (data.pricePerLiter) payload.pricePerLiter = data.pricePerLiter;
    if (data.discount) payload.discount = data.discount;
    
    await addEventToSubcollection('abastecimento', payload);
  }, [activeCycleId, currentUser]);

  const handleUpdateConsumption = useCallback(async (newConsumption: number, date: string) => {
    await addEventToSubcollection('consumo', { type: 'consumption', value: newConsumption, date });
  }, [activeCycleId, currentUser]);

  const handleFinishCycle = useCallback(async () => {
    if (!currentUser || !activeCycleId || !activeCycleWithHistory) return;
    
    const finishTimestamp = firebase.firestore.Timestamp.now();
    
    await db.collection('usuarios').doc(currentUser.uid).collection('ciclos').doc(activeCycleId).collection('checkpoint').add({
        type: 'finish',
        value: activeCycleWithHistory.currentMileage,
        date: finishTimestamp
    });

    const cycleRef = db.collection('usuarios').doc(currentUser.uid).collection('ciclos').doc(activeCycleId);
    await cycleRef.update({ 
      status: 'finished',
      finishDate: finishTimestamp 
    });
  }, [currentUser, activeCycleId, activeCycleWithHistory]);

  const handleRequestDeleteCycle = (id: string) => setCycleToDeleteId(id);
  const handleCancelDelete = () => setCycleToDeleteId(null);

  const handleConfirmDelete = async () => {
    if (!cycleToDeleteId || !currentUser) return;
    
    const cycleDocRef = db.collection('usuarios').doc(currentUser.uid).collection('ciclos').doc(cycleToDeleteId);
    try {
      const batch = db.batch();
      const subcollections = ['abastecimento', 'checkpoint', 'consumo'];
      for (const sub of subcollections) {
          const subcollectionRef = cycleDocRef.collection(sub);
          const snapshot = await subcollectionRef.get();
          snapshot.forEach(doc => batch.delete(doc.ref));
      }
      
      batch.delete(cycleDocRef);
      await batch.commit();

      if (activeCycleId === cycleToDeleteId) handleGoHome();
      setCycleToDeleteId(null);
    } catch(e) {
      console.error("Error deleting cycle: ", e);
      alert("Ocorreu um erro ao excluir o ciclo.");
    }
  };

  const handleStartEditEvent = (event: HistoryEvent) => setEventToEdit(event);
  const handleCancelEditEvent = () => setEventToEdit(null);

  const getCollectionNameByType = (type: string) => {
      if (type === 'refuel') return 'abastecimento';
      if (type === 'consumption') return 'consumo';
      if (type === 'checkpoint' || type === 'route' || type === 'finish') return 'checkpoint';
      return null;
  };

  const handleSaveEditEvent = async (updatedEvent: HistoryEvent) => {
    if (!currentUser || !activeCycleId) return;
    
    const collectionName = getCollectionNameByType(updatedEvent.type);
    if (!collectionName) return; 

    const eventRef = db.collection('usuarios').doc(currentUser.uid).collection('ciclos').doc(activeCycleId).collection(collectionName).doc(updatedEvent.id);
    
    const payload: any = { ...updatedEvent, date: firebase.firestore.Timestamp.fromDate(new Date(updatedEvent.date)) };
    delete payload.id;
    
    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    await eventRef.update(payload);
    await updateParentAggregates(activeCycleId);
    
    setEventToEdit(null);
  };

  const handleRequestDeleteEvent = (event: HistoryEvent) => setEventToDelete(event);
  const handleCancelDeleteEvent = () => setEventToDelete(null);

  const handleConfirmDeleteEvent = async () => {
    if (!currentUser || !activeCycleId || !eventToDelete) return;
    
    const collectionName = getCollectionNameByType(eventToDelete.type);
    if (collectionName) {
        const eventRef = db.collection('usuarios').doc(currentUser.uid).collection('ciclos').doc(activeCycleId).collection(collectionName).doc(eventToDelete.id);
        await eventRef.delete();
        await updateParentAggregates(activeCycleId);
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
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#0A0A0A]">
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
