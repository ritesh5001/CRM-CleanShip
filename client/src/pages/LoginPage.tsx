import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { loginRequest } from '@/api/auth';
import { apiError } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Field';

export function LoginPage() {
  const { token, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (token) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { token, user } = await loginRequest(email, password);
      setAuth(token, user);
      toast.success(`Welcome back, ${user.name}`);
      navigate('/');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-600 to-brand-800 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-900">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 rounded-xl bg-brand-600 p-3 text-white">
            <Phone size={26} />
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">CleanShip CRM</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500">User Management</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@cleanship.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <Button type="submit" loading={loading} className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
