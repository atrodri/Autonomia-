import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Cycle, HistoryEvent } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { ChevronLeftIcon, MyLocationIcon, CopilotIcon } from './icons/Icons';
import { QRCode } from './ui/QRCode';
import { db, auth } from '../firebase';


declare global {
  interface Window {
    google: any;
  }
}

interface RouteViewProps {
  cycle?: Cycle;
  onEndTrip: () => void;
  onAddCheckpoint?: (distance: number, date: string, routeData: { origin: any; destination: any; traveledPath: { lat: number; lng: number }[] }) => void;
  tripToView?: HistoryEvent | null;
}

type ViewPhase = 'planning' | 'navigating' | 'viewing';
type PlanningSubPhase = 'input' | 'review';

const TripView: React.FC<RouteViewProps> = ({ cycle, onEndTrip, onAddCheckpoint, tripToView }) => {
  const [phase, setPhase] = useState<ViewPhase>(tripToView ? 'viewing' : 'planning');
  const [planningSubPhase, setPlanningSubPhase] = useState<PlanningSubPhase>('input');

  const [destination, setDestination] = useState('');
  const [route, setRoute] = useState<any>(null);
  const [tripSummary, setTripSummary] = useState<{ distance: string; duration: string }>({ distance: '', duration: '' });
  const [currentInstruction, setCurrentInstruction] = useState('');
  
  const [isFollowingUser, setIsFollowingUser] = useState(true);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isCopilotModalOpen, setIsCopilotModalOpen] = useState(false);
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [routeStatus, setRouteStatus] = useState<'idle' | 'calculating' | 'recalculating' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const destinationInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const directionsService = useRef<any>(null);
  const directionsRenderer = useRef<any>(null);
  const userPositionMarker = useRef<any>(null);
  const positionWatcher = useRef<number | null>(null);
  const lastPositionRef = useRef<any>(null);
  const traveledDistanceRef = useRef(0);
  const traveledPathRef = useRef<{ lat: number; lng: number; }[]>([]);
  const isRecalculatingRef = useRef(false);

  // Reset state when component opens for a new trip
  useEffect(() => {
    if (!tripToView) {
      traveledDistanceRef.current = 0;
      traveledPathRef.current = [];
      setDestination('');
      setRoute(null);
      setPhase('planning');
      setPlanningSubPhase('input');
      setLiveSessionId(null);
      isRecalculatingRef.current = false;
    }
  }, [tripToView]);


  const initMap = useCallback((center: { lat: number; lng: number }) => {
    if (mapRef.current && !mapInstance.current) {
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
            center: center,
            zoom: 15,
            disableDefaultUI: true,
            backgroundColor: '#0A0A0A',
            styles: [
                { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
                { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
                { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
                { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#FF6B00" }] },
                { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
            ],
        });

        mapInstance.current.addListener('dragstart', () => {
            if (phase === 'navigating') setIsFollowingUser(false);
        });

        directionsService.current = new window.google.maps.DirectionsService();
        directionsRenderer.current = new window.google.maps.DirectionsRenderer({
            polylineOptions: { strokeColor: '#FFEB3B', strokeWeight: 6, strokeOpacity: 0.9 },
            suppressMarkers: true,
        });
        directionsRenderer.current.setMap(mapInstance.current);
        setMapStatus('ready');
    }
  }, []);

  const setupAutocomplete = useCallback(() => {
    if (mapStatus === 'ready' && destinationInputRef.current) {
        const autocomplete = new window.google.maps.places.Autocomplete(destinationInputRef.current);
        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            setDestination(place?.formatted_address || place?.name || '');
            setError(null);
        });
    }
  }, [mapStatus]);
  
  useEffect(() => {
      const handleMapReady = () => {
          const defaultCenter = { lat: -23.55052, lng: -46.633308 };
          if (navigator.geolocation && phase !== 'viewing') {
              navigator.geolocation.getCurrentPosition(
                  (position) => initMap({ lat: position.coords.latitude, lng: position.coords.longitude }),
                  () => initMap(defaultCenter)
              );
          } else {
              initMap(defaultCenter);
          }
      };

      if (window.google?.maps) {
          handleMapReady();
      } else {
          window.addEventListener('google-maps-ready', handleMapReady, { once: true });
      }
      return () => window.removeEventListener('google-maps-ready', handleMapReady);
  }, [initMap, phase]);

  useEffect(() => {
    setupAutocomplete();
  }, [setupAutocomplete]);

  useEffect(() => {
    if (mapStatus === 'ready' && phase === 'viewing' && tripToView && tripToView.type === 'route') {
      if (tripToView.traveledPath && tripToView.traveledPath.length > 1) {
        const polyline = new window.google.maps.Polyline({
          path: tripToView.traveledPath,
          geodesic: true,
          strokeColor: '#FFEB3B',
          strokeOpacity: 0.9,
          strokeWeight: 6,
        });
        polyline.setMap(mapInstance.current);

        const bounds = new window.google.maps.LatLngBounds();
        tripToView.traveledPath.forEach(point => bounds.extend(point));
        mapInstance.current.fitBounds(bounds);

        if (tripToView.distanciaPercorrida) {
          setTripSummary({ distance: `${tripToView.distanciaPercorrida.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`, duration: 'Percurso Salvo' });
        }

      } else if (tripToView.origin && tripToView.destination) {
        // Fallback for old routes without traveledPath
        // Use coordinates if available in the saved objects, otherwise might fail if it's not proper geocodable string
        const requestOrigin = tripToView.origin.location ? tripToView.origin.location : tripToView.origin;
        const requestDestination = tripToView.destination.location ? tripToView.destination.location : tripToView.destination;

        directionsService.current.route(
          { origin: requestOrigin, destination: requestDestination, travelMode: 'DRIVING' },
          (result: any, status: string) => {
            if (status === 'OK') {
              directionsRenderer.current.setDirections(result);
              const leg = result.routes[0].legs[0];
              setTripSummary({ distance: leg.distance.text, duration: leg.duration.text });
            } else {
              setError("Não foi possível recarregar esta rota.");
            }
          }
        );
      }
    }
  }, [mapStatus, phase, tripToView]);


  const handleCalculateRoute = useCallback(() => {
    setRouteStatus('calculating');
    setError(null);
    if (!destination.trim()) {
        setError('Por favor, informe um destino.');
        setRouteStatus('error');
        return;
    }
    if (!navigator.geolocation) {
        setError('Geolocalização não é suportada pelo seu navegador.');
        setRouteStatus('error');
        return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const origin = { lat: position.coords.latitude, lng: position.coords.longitude };
        directionsService.current.route(
          { origin, destination, travelMode: 'DRIVING' },
          (result: any, status: string) => {
            if (status === 'OK' && result?.routes?.[0]?.legs?.[0]) {
              const leg = result.routes[0].legs[0];
              directionsRenderer.current.setDirections(result);
              setRoute(result);
              setTripSummary({ distance: leg.distance.text, duration: leg.duration.text });
              setPlanningSubPhase('review');
              setRouteStatus('idle');
            } else {
              setError('Não foi possível encontrar uma rota para o destino informado.');
              setRoute(null);
              setRouteStatus('error');
            }
          }
        );
      },
      () => {
        setError("Não foi possível obter sua localização.");
        setRouteStatus('error');
      }
    );
  }, [destination]);

  const serializeRouteData = (leg: any) => {
      return {
          origin: {
              address: leg.start_address,
              location: { lat: leg.start_location.lat(), lng: leg.start_location.lng() }
          },
          destination: {
              address: leg.end_address,
              location: { lat: leg.end_location.lat(), lng: leg.end_location.lng() }
          },
          steps: leg.steps.map((step: any) => ({
              instructions: step.instructions,
              distance: step.distance.text,
              duration: step.duration.text,
          })),
      };
  };

  const startNavigation = useCallback(async () => {
    if (!route || !auth.currentUser) return;
    try {
        const leg = route.routes[0].legs[0];
        const routeDataForCopilot = serializeRouteData(leg);

        // Fix: Use db.collection().add() (compat/v8 style)
        const sessionRef = await db.collection('live_sessions').add({
            driverId: auth.currentUser.uid,
            createdAt: new Date().toISOString(),
            routeData: routeDataForCopilot,
            currentStepIndex: 0,
        });
        setLiveSessionId(sessionRef.id);
        setPhase('navigating');
    } catch (e) {
        console.error("Failed to create live session:", e);
        setError("Não foi possível iniciar a sessão de co-piloto.");
    }
  }, [route]);

  // Cleanup live session on unmount or phase change
  useEffect(() => {
    return () => {
      if (liveSessionId) {
        // Fix: Use db.collection().doc().delete() (compat/v8 style)
        db.collection('live_sessions').doc(liveSessionId).delete().catch(err => {
            console.warn("Could not delete live session on cleanup (likely permission issue or already deleted):", err);
        });
      }
    };
  }, [liveSessionId]);

  const recalculateRoute = useCallback((currentPos: { lat: number, lng: number }) => {
      if (isRecalculatingRef.current || !directionsService.current) return;
      
      isRecalculatingRef.current = true;
      setRouteStatus('recalculating');
      console.log("Recalculando rota...");

      // Use the original destination from the current route
      const currentRouteLeg = route.routes[0].legs[0];
      const destLocation = currentRouteLeg.end_location;

      directionsService.current.route(
          { origin: currentPos, destination: destLocation, travelMode: 'DRIVING' },
          (result: any, status: string) => {
              if (status === 'OK' && result?.routes?.[0]?.legs?.[0]) {
                  const leg = result.routes[0].legs[0];
                  directionsRenderer.current.setDirections(result);
                  setRoute(result);
                  setTripSummary({ distance: leg.distance.text, duration: leg.duration.text });
                  
                  // Update live session with new route data
                  if (liveSessionId) {
                      const newRouteData = serializeRouteData(leg);
                      // Fix: Use db.collection().doc().update() (compat/v8 style)
                      db.collection('live_sessions').doc(liveSessionId).update({
                          routeData: newRouteData,
                          currentStepIndex: 0 // Reset step index for new route
                      }).catch(err => console.error("Error updating route for copilot", err));
                  }
              } else {
                  console.warn("Falha ao recalcular rota:", status);
              }
              isRecalculatingRef.current = false;
              setRouteStatus('idle');
          }
      );
  }, [route, liveSessionId]);


  useEffect(() => {
    if (phase !== 'navigating') {
        if (positionWatcher.current !== null) navigator.geolocation.clearWatch(positionWatcher.current);
        return;
    }
    
    if (mapInstance.current && route) {
        // Only fit bounds initially, not on every update unless tracking is on, handled below
        if (!userPositionMarker.current) {
             const routeBounds = route.routes[0].bounds;
             mapInstance.current.fitBounds(routeBounds);
        }
    }
    
    let currentStepIndex = 0;
    if (route && route.routes[0].legs[0].steps[0]) {
        setCurrentInstruction(route.routes[0].legs[0].steps[0].instructions.replace(/<[^>]*>/g, ''));
    }

    positionWatcher.current = navigator.geolocation.watchPosition(async (position) => {
        const newPosition = { lat: position.coords.latitude, lng: position.coords.longitude };
        traveledPathRef.current.push(newPosition);

        const heading = position.coords.heading ?? (lastPositionRef.current ? window.google.maps.geometry.spherical.computeHeading(new window.google.maps.LatLng(lastPositionRef.current), new window.google.maps.LatLng(newPosition)) : 0);
        
        if (lastPositionRef.current) {
            traveledDistanceRef.current += window.google.maps.geometry.spherical.computeDistanceBetween(
                new window.google.maps.LatLng(lastPositionRef.current),
                new window.google.maps.LatLng(newPosition)
            );
        }
        
        // --- Off-route Detection and Recalculation ---
        if (route && !isRecalculatingRef.current) {
            const pathPolyline = new window.google.maps.Polyline({
                path: route.routes[0].overview_path
            });
            
            const currentLatLng = new window.google.maps.LatLng(newPosition.lat, newPosition.lng);
            // isLocationOnEdge(point, poly, toleranceDegrees). 10e-5 degrees is approx 10-12 meters.
            // Using 2e-4 (~20-25 meters) tolerance to avoid jitter recalculation.
            const isOnPath = window.google.maps.geometry.poly.isLocationOnEdge(currentLatLng, pathPolyline, 2e-4);
            
            if (!isOnPath) {
                recalculateRoute(newPosition);
            }
        }
        // ---------------------------------------------

        // Find current step (only if we didn't just trigger a recalculation)
        if (route && !isRecalculatingRef.current) {
            const steps = route.routes[0].legs[0].steps;
            let closestStepIndex = currentStepIndex;
            let smallestDistance = Infinity;

            for (let i = 0; i < steps.length; i++) {
                // Optimization: Only check current and next few steps to avoid loop entire array
                // For simplicity, checking all for now or check bounds
                for (let j = 0; j < steps[i].path.length; j += 5) { // Check every 5th point for perf
                    const distance = window.google.maps.geometry.spherical.computeDistanceBetween(
                        new window.google.maps.LatLng(newPosition),
                        steps[i].path[j]
                    );
                    if (distance < smallestDistance) {
                        smallestDistance = distance;
                        closestStepIndex = i;
                    }
                }
            }
            
            if (closestStepIndex !== currentStepIndex) {
                currentStepIndex = closestStepIndex;
                setCurrentInstruction(steps[currentStepIndex].instructions.replace(/<[^>]*>/g, ''));
            }
        }

        if (liveSessionId) {
            // Fix: Use db.collection().doc().update() (compat/v8 style)
            await db.collection('live_sessions').doc(liveSessionId).update({
                position: newPosition,
                heading,
                currentStepIndex,
            });
        }

        if (!userPositionMarker.current) {
            userPositionMarker.current = new window.google.maps.Marker({
                position: newPosition,
                map: mapInstance.current,
                icon: {
                    path: 'M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z', // Arrow icon
                    fillColor: '#FF6B00',
                    fillOpacity: 1,
                    strokeColor: '#FFFFFF',
                    strokeWeight: 2,
                    scale: 1.5,
                    anchor: new window.google.maps.Point(12, 12),
                    rotation: heading,
                },
            });
        } else {
            userPositionMarker.current.setPosition(newPosition);
            const icon = userPositionMarker.current.getIcon();
            icon.rotation = heading;
            userPositionMarker.current.setIcon(icon);
        }

        if (isFollowingUser) {
            mapInstance.current.panTo(newPosition);
            mapInstance.current.setZoom(18);
        }
        lastPositionRef.current = newPosition;

    }, (err) => console.error("Error watching position:", err), { enableHighAccuracy: true });

    return () => {
        if (positionWatcher.current !== null) navigator.geolocation.clearWatch(positionWatcher.current);
    };
  }, [phase, route, isFollowingUser, liveSessionId, recalculateRoute]);


  const finishRoute = () => {
    if (liveSessionId) {
        // Fix: Use db.collection().doc().delete() (compat/v8 style)
        db.collection('live_sessions').doc(liveSessionId).delete().catch(err => console.warn("Delete session failed:", err));
        setLiveSessionId(null);
    }
    setIsConfirmModalOpen(true);
  };

  const handleConfirmCheckpoint = () => {
    if (onAddCheckpoint && route) {
        const distanceInKm = traveledDistanceRef.current / 1000;
        const leg = route.routes[0].legs[0];
        
        // Use plain objects for saving to Firestore
        onAddCheckpoint(distanceInKm, new Date().toISOString(), {
            origin: {
                address: leg.start_address,
                location: { lat: leg.start_location.lat(), lng: leg.start_location.lng() }
            },
            destination: {
                address: leg.end_address,
                location: { lat: leg.end_location.lat(), lng: leg.end_location.lng() }
            },
            traveledPath: traveledPathRef.current,
        });
    }
    setIsConfirmModalOpen(false);
    onEndTrip();
  };

  const renderPlanningUI = () => (
    <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
      <div className="bg-[#141414] rounded-lg shadow-lg p-6 space-y-4 max-w-lg mx-auto">
        {planningSubPhase === 'input' && (
          <>
            <h2 className="text-xl font-bold text-white text-center">Planejador de Rota</h2>
             <div className="w-full max-w-md mx-auto">
                <Input
                  ref={destinationInputRef}
                  label=""
                  id="destination"
                  type="text"
                  value={destination}
                  onChange={(e) => { setDestination(e.target.value); setError(null); }}
                  placeholder="Para onde vamos?"
                  disabled={mapStatus !== 'ready'}
                  className="w-full py-3 text-lg text-center bg-[#2a2a2a] text-[#CFCFCF]"
                />
            </div>

            {error && <p className="text-center text-red-500 text-sm">{error}</p>}
            
            <Button type="button" onClick={handleCalculateRoute} disabled={!destination || routeStatus === 'calculating' || mapStatus !== 'ready'} className="w-full">
              {mapStatus === 'loading' ? 'Carregando Mapa...' : routeStatus === 'calculating' ? 'Calculando...' : 'Calcular Rota'}
            </Button>
          </>
        )}
        {planningSubPhase === 'review' && route && (
          <div className="space-y-4 text-center">
            <p className="text-lg">Resumo da Rota</p>
            <p className="text-2xl font-bold text-[#FF6B00]">
              {tripSummary.distance} <span className="text-lg text-white">({tripSummary.duration})</span>
            </p>
            <Button type="button" onClick={startNavigation} className="w-full">
              Iniciar Navegação
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  const renderNavigationUI = () => (
     <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3 z-10">
        <div className="relative max-w-lg mx-auto">
            {!isFollowingUser && (
                <button type="button" onClick={() => setIsFollowingUser(true)} className="absolute -top-14 right-0 bg-[#141414]/80 p-2 rounded-full border border-[#444] shadow-lg text-[#FF6B00]">
                    <MyLocationIcon className="w-6 h-6" />
                </button>
            )}
             <button type="button" onClick={() => setIsCopilotModalOpen(true)} className="absolute -top-14 left-0 bg-[#141414]/80 p-2 rounded-full border border-[#444] shadow-lg text-[#FF6B00]">
                <CopilotIcon className="w-6 h-6" />
            </button>
        </div>
      <div className="bg-[#141414]/90 p-4 rounded-lg shadow-lg text-center border border-[#444] max-w-lg mx-auto">
        <p className="text-lg font-semibold text-white min-h-[28px]">
          {routeStatus === 'recalculating' ? 'Recalculando rota...' : (currentInstruction || 'Siga a rota')}
        </p>
      </div>
      <div className="max-w-lg mx-auto w-full">
        <Button type="button" onClick={finishRoute} variant="danger" className="w-full">
            Finalizar Rota
        </Button>
      </div>
    </div>
  );

  return (
    <div className={`fixed inset-0 bg-[#0A0A0A] z-40 flex flex-col ${phase === 'navigating' || phase === 'viewing' ? 'is-navigating' : ''}`}>
      <div className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center">
        <button type="button" onClick={onEndTrip} className="bg-[#141414]/80 p-2 rounded-lg border border-[#444] shadow-lg text-[#FF6B00] hover:text-[#ff852b] transition-colors flex items-center text-sm">
          <ChevronLeftIcon className="w-5 h-5 mr-1" />
          {phase === 'navigating' ? 'Sair da Navegação' : 'Voltar'}
        </button>
      </div>

      <div ref={mapRef} className="absolute inset-0 z-0" />
      
      {phase === 'planning' && renderPlanningUI()}
      {phase === 'navigating' && renderNavigationUI()}
      {phase === 'viewing' && tripSummary.distance && (
          <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
              <div className="bg-[#141414]/90 p-4 rounded-lg shadow-lg text-center border border-[#444] max-w-lg mx-auto">
                  <p className="text-lg font-semibold text-white">
                      {tripSummary.distance} <span className="text-sm text-[#CFCFCF]">({tripSummary.duration})</span>
                  </p>
              </div>
          </div>
      )}


      <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="Registrar Rota">
        <div className="space-y-4">
          <p>Deseja adicionar a distância percorrida de <strong className="text-[#FF6B00]">{`~${(traveledDistanceRef.current / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`}</strong> como um novo checkpoint no ciclo?</p>
          <div className="pt-2 flex gap-4">
            <Button type="button" variant="secondary" onClick={() => { setIsConfirmModalOpen(false); onEndTrip(); }} className="w-full">Não</Button>
            <Button type="button" onClick={handleConfirmCheckpoint} className="w-full">Sim, Adicionar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isCopilotModalOpen} onClose={() => setIsCopilotModalOpen(false)} title="Modo Co-piloto">
        {liveSessionId && (
            <div className="flex flex-col items-center text-center">
                <p className="mb-4">Peça para seu co-piloto escanear o QR Code abaixo para acompanhar a rota em tempo real.</p>
                <QRCode value={`${window.location.origin}${window.location.pathname}?sessionId=${liveSessionId}`} />
            </div>
        )}
      </Modal>
    </div>
  );
};

export default TripView;