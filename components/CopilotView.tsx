
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
  const [status, setStatus] = useState<CopilotStatus>('connecting');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initMap = (center: { lat: number; lng: number }) => {
      if (mapRef.current && !mapInstance.current) {
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: 18,
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
      }
    };

    const handleMapReady = () => {
        initMap({ lat: -23.55052, lng: -46.633308 }); // Default center
    };

    if (window.google?.maps) {
        handleMapReady();
    } else {
        window.addEventListener('google-maps-ready', handleMapReady, { once: true });
    }
    return () => window.removeEventListener('google-maps-ready', handleMapReady);
  }, []);

  useEffect(() => {
    if (!sessionId || !mapInstance.current) return;

    const sessionDocRef = doc(db, 'live_sessions', sessionId);
    const unsubscribe = onSnapshot(sessionDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setStatus('active');
        const data = docSnap.data();
        const position = data.position;
        const heading = data.heading;
        
        if (position) {
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
        setStatus('ended');
        if (driverMarker.current) {
          driverMarker.current.setMap(null);
        }
      }
    }, (err) => {
      console.error("Error listening to live session:", err);
      setError("Não foi possível conectar à sessão do motorista.");
      setStatus('ended');
    });

    return () => unsubscribe();
  }, [sessionId, mapInstance.current]);

  return (
    <div className="fixed inset-0 bg-[#0A0A0A] z-50">
      <div ref={mapRef} className="absolute inset-0 z-0" />
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        {status === 'connecting' && (
          <div className="bg-[#141414]/90 p-4 rounded-lg text-center">
            <h2 className="text-lg font-bold text-white">Conectando ao motorista...</h2>
          </div>
        )}
        {status === 'ended' && (
          <div className="bg-[#141414]/90 p-6 rounded-lg text-center shadow-lg border border-[#444]">
            <h2 className="text-xl font-bold text-white">Navegação Finalizada</h2>
            <p className="text-[#CFCFCF] mt-2">O motorista encerrou esta rota. Você pode fechar esta janela.</p>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>
        )}
      </div>
       <div className="absolute top-0 left-0 right-0 p-4 z-20">
          <h1 className="text-lg font-bold text-white tracking-tight text-center bg-[#141414]/80 p-2 rounded-lg border border-[#444] max-w-xs mx-auto">
            autonomia<span className="text-[#FF6B00]">+</span> Co-piloto
          </h1>
        </div>
    </div>
  );
};

export default CopilotView;
