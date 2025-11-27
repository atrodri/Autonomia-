import React from 'react';
import { LogoutIcon, UserIcon } from './icons/Icons';
// Fix: Use auth.signOut() from the compat library instead of the v9 signOut function.
import { auth } from '../firebase';

interface HeaderProps {
    userName?: string | null;
    userPhotoURL?: string | null;
    onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ userName, userPhotoURL, onOpenSettings }) => {
  const handleLogout = async () => {
    try {
        // Fix: Use auth.signOut() (compat/v8 style) instead of signOut(auth) (v9 style).
        await auth.signOut();
    } catch (error) {
        console.error("Error signing out", error);
    }
  };

  return (
  <header className="py-4 px-4 md:px-6 flex justify-between items-center">
    <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-3">
             {onOpenSettings ? (
                <button onClick={onOpenSettings} className="group relative flex items-center justify-center" title="Configurações do Perfil">
                   <div className="w-10 h-10 rounded-full bg-[#2a2a2a] overflow-hidden border border-[#444] group-hover:border-[#FF6B00] transition-colors flex items-center justify-center">
                      {userPhotoURL ? (
                          <img src={userPhotoURL} alt={userName || 'User'} className="w-full h-full object-cover" />
                      ) : (
                          <UserIcon className="w-6 h-6 text-[#888] group-hover:text-[#FF6B00]" />
                      )}
                   </div>
                   {userName && (
                       <span className="ml-3 font-semibold text-white hidden md:block">{userName}</span>
                   )}
                </button>
             ) : (
                 <h1 className="text-2xl font-bold text-white tracking-tight">autonomia<span className="text-[#FF6B00]">+</span></h1>
             )}
        </div>
        <div className="flex items-center gap-4">
             <button onClick={handleLogout} className="text-[#CFCFCF] hover:text-white transition-colors" title="Sair">
                <LogoutIcon className="w-6 h-6" />
             </button>
        </div>
    </div>
  </header>
  );
};