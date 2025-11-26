import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Cycle } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { ChevronLeftIcon, MyLocationIcon } from './icons/Icons';

declare global {
  interface Window {
    google: any;
  }
}

interface TripViewProps {
  cycle: Cycle;
  onEndTrip: () => void;
  onAddCheckpoint: (distance: number, date: string) => void;
}

type NavigationState = 'planning' | 'calculated' | 'navigating' | 'finished';

const TripView: React.FC<TripViewProps> = ({ cycle, onEndTrip, onAddCheckpoint }) => {
  const [destination, setDestination] = useState('');
  const [navigationState, setNavigationState] = useState<NavigationState>('planning');
  const [route, setRoute] = useState<any>(null);
  const [tripSummary, setTripSummary] = useState<{ distance: string; duration: string }>({ distance: '', duration: '' });
  const [currentInstruction, setCurrentInstruction] = useState('');
  const [isFollowingUser, setIsFollowingUser] = useState(true);
  
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [finalTraveledDistance, setFinalTraveledDistance] = useState(0); // in meters
  
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const directionsService = useRef<any>(null);
  const directionsRenderer = useRef<any>(null);
  const userPositionMarker = useRef<any>(null);
  const positionWatcher = useRef<number | null>(null);
  const currentStepIndex = useRef(0);
  const traveledDistanceRef = useRef(0);
  const lastPositionRef = useRef<any>(null);

  const isNavigating = navigationState === 'navigating';

  // Initialize Map and Services
  useEffect(() => {
    if (window.google && mapRef.current && !mapInstance.current) {
        const defaultCenter = { lat: -23.55052, lng: -46.633308 }; // São Paulo

        const initializeMap = (center: { lat: number; lng: number }) => {
            mapInstance.current = new window.google.maps.Map(mapRef.current, {
                center: center,
                zoom: 12,
                disableDefaultUI: true,
                backgroundColor: '#0A0A0A',
                styles: [
                    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                    {
                        featureType: "administrative.locality",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#d59563" }],
                    },
                    {
                        featureType: "poi",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#d59563" }],
                    },
                    {
                        featureType: "poi.park",
                        elementType: "geometry",
                        stylers: [{ color: "#263c3f" }],
                    },
                    {
                        featureType: "road",
                        elementType: "geometry",
                        stylers: [{ color: "#38414e" }],
                    },
                    {
                        featureType: "road",
                        elementType: "geometry.stroke",
                        stylers: [{ color: "#212a37" }],
                    },
                    {
                        featureType: "road",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#9ca5b3" }],
                    },
                    {
                        featureType: "road.highway",
                        elementType: "geometry",
                        stylers: [{ color: "#FF6B00" }],
                    },
                    {
                        featureType: "road.highway",
                        elementType: "geometry.stroke",
                        stylers: [{ color: "#1f2835" }],
                    },
                    {
                        featureType: "transit",
                        elementType: "geometry",
                        stylers: [{ color: "#2f3948" }],
                    },
                    {
                        featureType: "water",
                        elementType: "geometry",
                        stylers: [{ color: "#17263c" }],
                    },
                    {
                        featureType: "water",
                        elementType: "labels.text.fill",
                        stylers: [{ color: "#515c6d" }],
                    },
                ],
            });

            mapInstance.current.addListener('dragstart', () => {
                setIsFollowingUser(false);
            });

            directionsService.current = new window.google.maps.DirectionsService();
            directionsRenderer.current = new window.google.maps.DirectionsRenderer({
                polylineOptions: {
                    strokeColor: '#FF6B00',
                    strokeWeight: 6,
                    strokeOpacity: 0.8,
                },
                suppressMarkers: true,
            });
            directionsRenderer.current.setMap(mapInstance.current);
        };
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    initializeMap({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                () => {
                    initializeMap(defaultCenter); // Fallback on error/denial
                }
            );
        } else {
            initializeMap(defaultCenter); // Fallback if geolocation is not supported
        }
    }
  }, []);

  // Initialize Autocomplete
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places && destinationInputRef.current) {
      const autocomplete = new window.google.maps.places.Autocomplete(
        destinationInputRef.current,
        { types: ['address'], componentRestrictions: { country: 'br' } }
      );
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place && place.formatted_address) {
          setDestination(place.formatted_address);
        }
      });
    }
  }, []);

  const calculateRoute = useCallback(() => {
    if (!destination.trim() || !directionsService.current || !directionsRenderer.current) {
      alert('Por favor, informe um destino válido.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const origin = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        directionsService.current.route(
          {
            origin: origin,
            destination: destination,
            travelMode: 'DRIVING',
          },
          (result: any, status: string) => {
            if (status === 'OK') {
              directionsRenderer.current.setDirections(result);
              setRoute(result);
              const leg = result.routes[0].legs[0];
              setTripSummary({ distance: leg.distance.text, duration: leg.duration.text });
              setNavigationState('calculated');
            } else {
              alert('Não foi possível calcular a rota. Erro: ' + status);
            }
          }
        );
      },
      (error) => {
        alert('Não foi possível obter sua localização: ' + error.message);
      }
    );
  }, [destination]);

  const startNavigation = useCallback(() => {
    if (!route) return;
    
    setIsFollowingUser(true);
    setNavigationState('navigating');
    currentStepIndex.current = 0;
    traveledDistanceRef.current = 0;
    lastPositionRef.current = null;
    const firstStep = route.routes[0].legs[0].steps[0];
    setCurrentInstruction(firstStep.instructions.replace(/<[^>]*>/g, '')); // Remove HTML tags
  }, [route]);

  useEffect(() => {
    if (navigationState !== 'navigating') {
      if (positionWatcher.current !== null) {
        navigator.geolocation.clearWatch(positionWatcher.current);
        positionWatcher.current = null;
      }
      return;
    }

    positionWatcher.current = navigator.geolocation.watchPosition(
      (position) => {
        const currentPos = { lat: position.coords.latitude, lng: position.coords.longitude };
        
        if (lastPositionRef.current) {
            const distanceIncrement = window.google.maps.geometry.spherical.computeDistanceBetween(
                new window.google.maps.LatLng(lastPositionRef.current),
                new window.google.maps.LatLng(currentPos)
            );
            traveledDistanceRef.current += distanceIncrement;
        }
        lastPositionRef.current = currentPos;


        if (!userPositionMarker.current) {
          userPositionMarker.current = new window.google.maps.Marker({
            position: currentPos,
            map: mapInstance.current,
            icon: {
              path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 8,
              rotation: position.coords.heading || 0,
              fillColor: '#FFFFFF',
              fillOpacity: 1,
              strokeColor: '#FF6B00',
              strokeWeight: 3,
            },
          });
        } else {
          userPositionMarker.current.setPosition(currentPos);
          if (position.coords.heading !== null) {
            const icon = userPositionMarker.current.getIcon();
            icon.rotation = position.coords.heading;
            userPositionMarker.current.setIcon(icon);
          }
        }

        if (isFollowingUser) {
          mapInstance.current.setCenter(currentPos);
          mapInstance.current.setZoom(18);
        }

        // Check if user is close to the next step
        const currentLeg = route.routes[0].legs[0];
        const nextStep = currentLeg.steps[currentStepIndex.current];
        if (nextStep) {
          const distanceToNextStep = window.google.maps.geometry.spherical.computeDistanceBetween(
            new window.google.maps.LatLng(currentPos),
            nextStep.end_location
          );

          if (distanceToNextStep < 25) { // 25 meters threshold
            currentStepIndex.current++;
            const upcomingStep = currentLeg.steps[currentStepIndex.current];
            if (upcomingStep) {
              setCurrentInstruction(upcomingStep.instructions.replace(/<[^>]*>/g, ''));
            } else {
              setCurrentInstruction('Você chegou ao seu destino.');
            }
          }
        }
      },
      () => { alert('Erro ao rastrear localização.'); },
      { enableHighAccuracy: true }
    );
    
    return () => {
        if (positionWatcher.current !== null) {
            navigator.geolocation.clearWatch(positionWatcher.current);
            positionWatcher.current = null;
        }
    }
  }, [navigationState, route, isFollowingUser]);


  const finishTrip = useCallback(() => {
    if (positionWatcher.current !== null) {
      navigator.geolocation.clearWatch(positionWatcher.current);
      positionWatcher.current = null;
    }
    setFinalTraveledDistance(traveledDistanceRef.current);
    setNavigationState('finished');
    setIsConfirmModalOpen(true);
  }, []);

  const handleRecenterMap = useCallback(() => {
    if (lastPositionRef.current && mapInstance.current) {
        setIsFollowingUser(true);
        mapInstance.current.panTo(lastPositionRef.current);
        mapInstance.current.setZoom(18);
    }
  }, []);

  const handleConfirmCheckpoint = () => {
    // finalTraveledDistance is in meters, onAddCheckpoint expects km
    if (finalTraveledDistance > 0) {
        onAddCheckpoint(finalTraveledDistance / 1000, new Date().toISOString());
    }
    setIsConfirmModalOpen(false);
    onEndTrip();
  };

  const handleDeclineCheckpoint = () => {
    setIsConfirmModalOpen(false);
    onEndTrip();
  };

  const renderPlanningContent = () => {
    switch (navigationState) {
      case 'planning':
        return (
          <div className="space-y-4">
            <Input
              ref={destinationInputRef}
              label="Qual o seu destino?"
              id="destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Ex: Praia Grande, SP"
            />
            <Button onClick={calculateRoute} className="w-full">
              Calcular Rota
            </Button>
          </div>
        );
      case 'calculated':
        return (
            <div className="space-y-4 text-center">
                <div className="bg-[#0A0A0A] p-3 rounded-md border border-[#444]">
                    <p className="text-lg">Resumo da Viagem</p>
                    <p className="text-2xl font-bold text-[#FF6B00]">
                        {tripSummary.distance} <span className="text-lg text-white">({tripSummary.duration})</span>
                    </p>
                </div>
                <Button onClick={startNavigation} className="w-full">
                    Iniciar Navegação
                </Button>
            </div>
        );
       case 'finished':
         return (
             <div className="text-center">
                <p className="text-lg">Trajeto finalizado!</p>
                <p className="text-sm text-[#888]">Aguardando confirmação para adicionar checkpoint...</p>
             </div>
         );
      default:
        return null;
    }
  };

  return (
    <>
        <div className={`w-full transition-all duration-300 ${isNavigating ? 'h-[calc(100vh-120px)] md:h-[calc(100vh-150px)]' : 'max-w-2xl mx-auto'}`}>
            <div className={`${isNavigating ? 'absolute top-4 left-4 z-20' : 'mb-4'}`}>
                <button onClick={onEndTrip} className="text-[#FF6B00] hover:text-[#ff852b] transition-colors flex items-center text-sm bg-black/50 p-2 rounded-lg">
                    <ChevronLeftIcon className="w-5 h-5 mr-1" />
                    {isNavigating ? 'Sair da Navegação' : 'Voltar para o Ciclo'}
                </button>
            </div>

            <Card className={`w-full transition-all duration-300 ${isNavigating ? '!p-0 !bg-transparent !shadow-none !max-w-none h-full' : ''}`}>
                <div className={`text-center ${isNavigating ? 'hidden' : ''}`}>
                    <h2 className="text-2xl font-bold text-white mb-2">Planejador de Trajeto</h2>
                    <p className="text-sm text-[#CFCFCF] mb-6">Ciclo: {cycle.name}</p>
                </div>

                <div className={`relative ${isNavigating ? 'h-full w-full' : ''}`}>
                    <div 
                        ref={mapRef} 
                        className={`transition-all duration-300 ${isNavigating 
                            ? 'h-full w-full rounded-lg' 
                            : 'my-4 aspect-video w-full rounded-lg'} 
                            bg-[#0A0A0A] border border-[#444] overflow-hidden`}>
                    </div>

                    {isNavigating && (
                        <>
                           <button 
                             onClick={handleRecenterMap}
                             className="absolute top-4 right-4 z-10 bg-[#141414] bg-opacity-90 p-2 rounded-full shadow-lg border border-[#444] text-white hover:bg-[#2a2a2a]"
                             title="Centralizar na sua posição"
                           >
                             <MyLocationIcon className="w-6 h-6" />
                           </button>

                           <div className="absolute bottom-4 left-4 right-4 z-10 space-y-3">
                               <div className="bg-[#141414] bg-opacity-90 p-4 rounded-lg shadow-lg text-center border border-[#444]">
                                   <p className="text-lg font-semibold text-white min-h-[28px]" dangerouslySetInnerHTML={{ __html: currentInstruction || 'Iniciando navegação...' }}></p>
                               </div>
                               <Button onClick={finishTrip} variant="danger" className="w-full">
                                   Finalizar Trajeto
                               </Button>
                           </div>
                        </>
                    )}
                </div>
                
                <div className={isNavigating ? 'hidden' : ''}>
                    {renderPlanningContent()}
                </div>
            </Card>
        </div>
      
      <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="Registrar Checkpoint">
        <div className="space-y-4">
          <p>Deseja adicionar a distância percorrida de <strong className="text-[#FF6B00]">{(finalTraveledDistance / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km</strong> como um novo checkpoint no ciclo?</p>
          <div className="pt-2 flex gap-4">
            <Button variant="secondary" onClick={handleDeclineCheckpoint} className="w-full">Não, obrigado</Button>
            <Button onClick={handleConfirmCheckpoint} className="w-full">Sim, adicionar</Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default TripView;