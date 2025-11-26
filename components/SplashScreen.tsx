
import React, { useState, useEffect } from 'react';

const SplashScreen: React.FC = () => {
    const [phase, setPhase] = useState<'start' | 'animate' | 'end'>('start');
    const [isFadingOut, setIsFadingOut] = useState(false);

    useEffect(() => {
        const t1 = setTimeout(() => setPhase('animate'), 100);
        const t2 = setTimeout(() => setPhase('end'), 1500);
        const t3 = setTimeout(() => setIsFadingOut(true), 2200);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, []);
    
    const containerStyles: React.CSSProperties = {
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        fontWeight: 'bold',
        color: 'white',
        overflow: 'hidden',
    };

    return (
        <div 
            className={`fixed inset-0 bg-[#0A0A0A] flex items-center justify-center z-50 transition-opacity duration-300 ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}
        >
            <div 
                className="text-5xl md:text-7xl"
                style={containerStyles}
            >
                {/* 'a' character */}
                <div className={`transition-transform duration-700 ease-in-out ${phase === 'animate' || phase === 'end' ? 'translate-x-0' : 'translate-x-[55%]'}`}>
                    <span className="tracking-tighter">a</span>
                </div>

                {/* 'utonomia' text that appears */}
                <div 
                    className="overflow-hidden transition-all duration-700 ease-in-out"
                    style={{ maxWidth: phase === 'end' ? '30rem' : '0' }}
                >
                     <span className={`tracking-tighter transition-opacity duration-300 delay-500 whitespace-nowrap ${phase === 'end' ? 'opacity-100' : 'opacity-0'}`}>
                        utonomia
                     </span>
                </div>

                {/* '+' character */}
                <div className={`transition-transform duration-700 ease-in-out ${phase === 'animate' || phase === 'end' ? 'translate-x-0' : 'translate-x-[-55%]'}`}>
                    <span className="text-[#FF6B00] tracking-tighter">+</span>
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
