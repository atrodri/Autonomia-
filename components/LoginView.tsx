import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

interface LoginViewProps {
  onSwitchToRegister: () => void;
  onSuccess: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onSwitchToRegister, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password) {
      setError("Por favor, preencha todos os campos.");
      setLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onSuccess();
    } catch (err: any) {
      const errorCodes = ['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'];
      if (errorCodes.includes(err.code)) {
        // This is an expected user error, not an application bug.
        // Don't log it as a critical error to the console.
        setError("Nome de usuário/senha incorretos.");
      } else {
        // This is an unexpected error.
        console.error("Login failed with unexpected error:", err);
        setError("Ocorreu um erro ao fazer login. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-sm">
      <h2 className="text-2xl font-bold text-[#FF6B00] mb-6 text-center">Login</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
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
          autoComplete="current-password"
          required
        />
        {error && <p className="text-center text-sm text-red-500">{error}</p>}
        <div className="pt-2 space-y-2">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
          <p className="text-center text-sm text-[#888]">
            Não tem uma conta?{' '}
            <button type="button" onClick={onSwitchToRegister} className="font-semibold text-[#FF6B00] hover:underline">
              Registre-se
            </button>
          </p>
        </div>
      </form>
    </Card>
  );
};

export default LoginView;