import React, { useState } from 'react';
import { User, updateProfile, updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, storage, db } from '../firebase';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { CameraIcon, UserIcon } from './icons/Icons';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
}

const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'account'>('profile');
  
  // Profile State
  const [displayName, setDisplayName] = useState(currentUser.displayName || '');
  const [photoURL, setPhotoURL] = useState(currentUser.photoURL || '');
  const [uploading, setUploading] = useState(false);
  
  // Account State
  const [email, setEmail] = useState(currentUser.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState(''); // For re-auth
  
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdateProfile = async () => {
    setMessage(null);
    try {
      // Update Firebase Auth profile
      await updateProfile(currentUser, {
        displayName: displayName,
        photoURL: photoURL
      });
      
      // Update Firestore document
      const userDocRef = doc(db, "usuarios", currentUser.uid);
      await updateDoc(userDocRef, {
        displayName: displayName,
        photoURL: photoURL
      });

      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Erro ao atualizar perfil: ' + error.message });
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploading(true);
      setMessage(null);
      try {
        const storageRef = ref(storage, `user_avatars/${currentUser.uid}/${file.name}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        setPhotoURL(url);
        setMessage({ type: 'success', text: 'Imagem enviada! Clique em "Salvar Perfil" para aplicar.'})
      } catch (error: any) {
        setMessage({ type: 'error', text: 'Erro ao fazer upload da imagem.' });
      } finally {
        setUploading(false);
      }
    }
  };

  const handleUpdateAccount = async () => {
    setMessage(null);
    if (!currentPassword) {
      setMessage({ type: 'error', text: 'A senha atual é necessária para alterações sensíveis.' });
      return;
    }
    
    if (!currentUser.email) {
      setMessage({ type: 'error', text: 'Usuário sem e-mail válido para reautenticação.' });
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);

      // Update email if changed
      if (email !== currentUser.email) {
        await updateEmail(currentUser, email);
        const userDocRef = doc(db, "usuarios", currentUser.uid);
        await updateDoc(userDocRef, { email: email });
      }

      // Update password if new one is provided
      if (newPassword) {
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'As novas senhas não coincidem.' });
            return;
        }
        await updatePassword(currentUser, newPassword);
      }

      setMessage({ type: 'success', text: 'Conta atualizada com sucesso!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
       const errorCodes = ['auth/wrong-password', 'auth/invalid-credential'];
       if (errorCodes.includes(error.code)) {
           // Expected user error, don't log to console as a critical error.
           setMessage({ type: 'error', text: 'Senha atual incorreta.' });
       } else {
           // Unexpected error.
           console.error("Re-authentication failed with unexpected error:", error);
           setMessage({ type: 'error', text: 'Erro ao atualizar conta: ' + error.message });
       }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurações">
      <div className="flex border-b border-[#2a2a2a] mb-4">
        <button 
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'profile' ? 'text-[#FF6B00] border-b-2 border-[#FF6B00]' : 'text-[#888]'}`}
          onClick={() => { setActiveTab('profile'); setMessage(null); }}
        >
          Perfil
        </button>
        <button 
          className={`flex-1 py-2 text-sm font-medium ${activeTab === 'account' ? 'text-[#FF6B00] border-b-2 border-[#FF6B00]' : 'text-[#888]'}`}
          onClick={() => { setActiveTab('account'); setMessage(null); }}
        >
          Conta
        </button>
      </div>

      {message && (
        <div className={`p-2 mb-4 rounded text-sm text-center ${message.type === 'success' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
          {message.text}
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-2 mb-4 relative">
             <div className="w-24 h-24 rounded-full bg-[#2a2a2a] overflow-hidden flex items-center justify-center border-2 border-[#FF6B00]">
                {photoURL ? (
                  <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-12 h-12 text-[#888]" />
                )}
             </div>
             <label className="cursor-pointer bg-[#2a2a2a] px-3 py-1 rounded-full flex items-center gap-2 text-xs text-[#CFCFCF] hover:bg-[#3a3a3a] border border-[#444]">
                <CameraIcon className="w-4 h-4" />
                {uploading ? 'Enviando...' : 'Alterar Foto'}
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
             </label>
          </div>

          <Input 
            label="Nome de Exibição" 
            id="displayName" 
            type="text" 
            value={displayName} 
            onChange={(e) => setDisplayName(e.target.value)} 
          />

          <Button onClick={handleUpdateProfile} className="w-full">Salvar Perfil</Button>
        </div>
      )}

      {activeTab === 'account' && (
        <div className="space-y-4">
          <Input 
            label="E-mail" 
            id="accountEmail" 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
          />
          <hr className="border-[#2a2a2a] my-2" />
          <h4 className="text-sm font-bold text-[#FF6B00]">Alterar Senha (Opcional)</h4>
          <Input 
            label="Nova Senha" 
            id="newPassword" 
            type="password" 
            value={newPassword} 
            onChange={(e) => setNewPassword(e.target.value)} 
          />
          <Input 
            label="Confirmar Nova Senha" 
            id="confirmPassword" 
            type="password" 
            value={confirmPassword} 
            onChange={(e) => setConfirmPassword(e.target.value)} 
          />
          
          <div className="bg-[#2a2a2a] p-4 rounded-md mt-4 border border-[#444]">
            <p className="text-xs text-[#888] mb-2">Para alterar e-mail ou senha, confirme sua senha atual:</p>
            <Input 
                label="Senha Atual" 
                id="currentPassword" 
                type="password" 
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)} 
            />
          </div>

          <Button onClick={handleUpdateAccount} className="w-full">Salvar Alterações</Button>
        </div>
      )}
    </Modal>
  );
};

export default UserSettingsModal;