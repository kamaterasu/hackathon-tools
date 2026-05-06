import { useState } from 'react';

const base = (import.meta.env.VITE_API_URL ?? '') + '/api';

export function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) { setError('Invalid password'); setLoading(false); return; }
      const { token } = await res.json();
      localStorage.setItem('adminToken', token);
      onLogin(token);
    } catch {
      setError('Could not reach server');
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-950">
      <form onSubmit={submit} className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-80 flex flex-col gap-4">
        <div className="text-center mb-2">
          <p className="text-2xl font-bold text-blue-400">Hackathon Tools</p>
          <p className="text-sm text-gray-500 mt-1">Admin access</p>
        </div>
        <input
          type="password"
          placeholder="Password"
          autoFocus
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
        />
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
