
import React, { useEffect, useRef, useState } from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';

declare global {
  interface Window {
    google: any;
  }
}

interface CopilotViewProps {
  sessionId: string;
}

type CopilotStatus = 'connecting' | 'active' | 'ended';

const CopilotView: React.FC<CopilotViewProps> = ({ sessionId }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const driverMarker = useRef<any>(null);
  const directionsRenderer = useRef<any>(null);

  const [status, setStatus] = useState<CopilotStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [currentInstruction, setCurrentInstruction] = useState('Aguardando início da navegação...');
  const [routeData, setRouteData] = useState<any>(null);

  useEffect(() => {
    const initMap = (center: { lat: number; lng: number }) => {
      if (mapRef.current && !mapInstance.current) {
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: 16,
          disableDefaultUI: true,
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
        directionsRenderer.current = new window.google.maps.DirectionsRenderer({
            polylineOptions: { strokeColor: '#FFEB3B', strokeWeight: 6, strokeOpacity: 0.9 },
            suppressMarkers: true,
        });
        directionsRenderer.current.setMap(mapInstance.current);
      }
    };

    const handleMapReady = () => {
        initMap({ lat: -23.55052, lng: -46.633308 });
    };

    if (window.google?.maps) {
        handleMapReady();
    } else {
        window.addEventListener('google-maps-ready', handleMapReady, { once: true });
    }
    return () => window.removeEventListener('google-maps-ready', handleMapReady);
  }, []);
  
  // Render route when data is available
  useEffect(() => {
    if (routeData && mapInstance.current && status === 'active') {
        const directionsService = new window.google.maps.DirectionsService();
        
        // Extract location coordinates from the serialized routeData object
        const originLoc = routeData.origin?.location;
        const destLoc = routeData.destination?.location;

        if (originLoc && destLoc) {
            directionsService.route(
                { 
                    origin: originLoc, 
                    destination: destLoc, 
                    travelMode: 'DRIVING' 
                },
                (result: any, status: string) => {
                    if (status === 'OK') {
                        if (directionsRenderer.current) {
                            directionsRenderer.current.setMap(mapInstance.current);
                            directionsRenderer.current.setDirections(result);
                        }
                    } else {
                        console.error("Copilot route calculation failed:", status);
                    }
                }
            );
        }
    }
  }, [routeData, mapInstance.current, status]);


  useEffect(() => {
    if (!sessionId) return;

    const sessionDocRef = doc(db, 'live_sessions', sessionId);
    const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setStatus('active');
        const data = docSnap.data();
        
        if (data.routeData && !routeData) {
            setRouteData(data.routeData);
        }

        const position = data.position;
        const heading = data.heading;
        const currentStepIndex = data.currentStepIndex;

        if (data.routeData?.steps && typeof currentStepIndex === 'number') {
            const instructionText = data.routeData.steps[currentStepIndex]?.instructions || "Continuar na rota";
            setCurrentInstruction(instructionText.replace(/<[^>]*>/g, ''));
        }
        
        if (position && mapInstance.current) {
          if (!driverMarker.current) {
            driverMarker.current = new window.google.maps.Marker({
              position,
              map: mapInstance.current,
              icon: {
                path: 'M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z',
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
            driverMarker.current.setPosition(position);
            const icon = driverMarker.current.getIcon();
            icon.rotation = heading;
            driverMarker.current.setIcon(icon);
          }
          mapInstance.current.panTo(position);
          mapInstance.current.setZoom(18);
        }
      } else {
        // Session document deleted = route finished
        setStatus('ended');
        
        // Clean up map elements
        if (driverMarker.current) {
          driverMarker.current.setMap(null);
        }
        if (directionsRenderer.current) {
            directionsRenderer.current.setMap(null); // Remove the route line
        }
      }
    }, (err) => {
      console.error("Error listening to live session:", err);
      setError("Não foi possível conectar à sessão do motorista.");
      setStatus('ended');
    });

    return () => unsubscribe();
  }, [sessionId, routeData]);

  const renderHeader = () => (
    <div className="absolute top-0 left-0 right-0 p-4 z-20">
      <div className="bg-[#141414]/80 p-3 rounded-lg border border-[#444] max-w-sm mx-auto text-center shadow-lg">
          <h1 className="text-xl font-bold text-white tracking-tight">
            autonomia<span className="text-[#FF6B00]">+</span>
          </h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#888]">Modo Co-piloto</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-[#0A0A0A] z-50">
      {status !== 'ended' && (
          <div ref={mapRef} className="absolute inset-0 z-0" />
      )}

      {status === 'active' && (
        <>
            {renderHeader()}
            <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3 z-10">
                <div className="bg-[#141414]/90 p-4 rounded-lg shadow-lg text-center border border-[#444] max-w-lg mx-auto">
                    <p className="text-lg font-semibold text-white min-h-[28px]">
                        {currentInstruction}
                    </p>
                </div>
            </div>
        </>
      )}
      
      {/* Loading State */}
      {status === 'connecting' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#141414] p-6 rounded-lg text-center border border-[#444]">
            <h2 className="text-lg font-bold text-white">Conectando ao motorista...</h2>
          </div>
        </div>
      )}

      {/* Ended State - Full Screen Block */}
      {status === 'ended' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0A0A0A]">
          <div className="w-full max-w-md p-8 text-center">
            <div className="mb-6 flex items-end justify-center opacity-50">
                <h1 className="text-4xl font-bold text-white tracking-tighter">
                autonomia<span className="text-[#FF6B00]">+</span>
                </h1>
            </div>
            <div className="bg-[#141414] p-8 rounded-xl shadow-2xl border border-[#333]">
                <h2 className="text-2xl font-bold text-white mb-2">Rota Finalizada</h2>
                <div className="w-16 h-1 bg-[#FF6B00] mx-auto mb-6 rounded-full"></div>
                <p className="text-[#CFCFCF] text-lg mb-6">
                    O motorista encerrou o trajeto ou a sessão expirou.
                </p>
                <p className="text-sm text-[#666] bg-[#0A0A0A] py-2 px-4 rounded-md inline-block">
                    Link indisponível
                </p>
                {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CopilotView;
