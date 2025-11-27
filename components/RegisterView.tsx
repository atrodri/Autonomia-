import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
// Fix: Use auth service methods from the compat library instead of v9 functions.
import { auth, db } from '../firebase';

interface RegisterViewProps {
  onSwitchToLogin: () => void;
  onCancel: () => void;
}

const RegisterView: React.FC<RegisterViewProps> = ({ onSwitchToLogin, onCancel }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName || !email || !password || !confirmPassword) {
      setError("Por favor, preencha todos os campos.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 6) {
        setError("A senha deve ter pelo menos 6 caracteres.");
        return;
    }

    setLoading(true);
    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      if (user) {
        await user.updateProfile({
          displayName: fullName
        });
      }


      // Add user to Firestore 'usuarios' collection
      // Fix: Use db.collection().doc().set() (compat/v8 style)
      await db.collection("usuarios").doc(user.uid).set({
        uid: user.uid,
        displayName: fullName,
        email: email,
        createdAt: new Date().toISOString()
      });

      // Authentication triggers onAuthStateChanged in App.tsx
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError("Este e-mail já está em uso.");
      } else if (err.code === 'auth/invalid-email') {
         setError("E-mail inválido.");
      } else {
        setError("Erro ao criar conta. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <h2 className="text-2xl font-bold text-[#FF6B00] mb-6 text-center">Registrar</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nome e Sobrenome"
          id="fullName"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          required
        />
        <Input
          label="E-mail"
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <Input
          label="Senha"
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <Input
          label="Confirmar Senha"
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        
        {error && <p className="text-center text-sm text-red-500">{error}</p>}

        <div className="pt-4 flex flex-col-reverse sm:flex-row gap-4">
          <Button type="button" variant="secondary" onClick={onCancel} className="w-full" disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Criando...' : 'Criar Conta'}
          </Button>
        </div>
        <div className="pt-2 text-center text-sm text-[#888]">
            Já tem uma conta?{' '}
            <button type="button" onClick={onSwitchToLogin} className="font-semibold text-[#FF6B00] hover:underline">
              Faça login
            </button>
        </div>
      </form>
    </Card>
  );
};

export default RegisterView;