import { useState } from 'react';
import { Eye, EyeOff, LogIn, Moon, Sun } from 'lucide-react';
import { useTheme } from '../utils/theme';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [email, setEmail] = useState('admin@sistema.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await onLogin(email, password);

    if (!result.success) {
      setError(result.error || 'Erro ao fazer login');
    }

    setLoading(false);
  };

  const isDark = resolvedTheme === 'dark';
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark');

  return (
    <div
      className={`
        min-h-screen flex items-center justify-center px-4 relative overflow-hidden transition-colors duration-500
        ${isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100' : 'bg-gradient-to-br from-blue-50 via-indigo-50 to-indigo-100 text-gray-900'}
      `}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute -left-28 -top-20 w-72 h-72 rounded-full blur-3xl ${isDark ? 'bg-indigo-500/10' : 'bg-blue-200/50'}`} />
        <div className={`absolute right-0 bottom-0 w-96 h-96 rounded-full blur-3xl ${isDark ? 'bg-cyan-500/10' : 'bg-indigo-200/60'}`} />
      </div>

      <div
        className={`
          relative max-w-md w-full rounded-2xl shadow-2xl border p-6 sm:p-8 backdrop-blur
          ${isDark ? 'bg-slate-900/80 border-white/5 shadow-black/40' : 'bg-white/90 border-white/60'}
        `}
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div
              className={`
                inline-flex items-center justify-center w-14 h-14 rounded-2xl
                ${isDark ? 'bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-blue-900/40' : 'bg-gradient-to-br from-blue-600 to-indigo-500 shadow-lg shadow-indigo-200'}
              `}
            >
              <LogIn className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Cliente Oculto</h1>
              <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>Sistema de Gestão de Avaliações</p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className={`
              inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all duration-200 border
              ${isDark ? 'bg-slate-800/80 border-white/10 text-slate-100 hover:bg-slate-800' : 'bg-white/70 border-gray-200 text-gray-700 hover:bg-white'}
            `}
            aria-pressed={isDark}
            aria-label="Alternar tema"
            title={isDark ? 'Usar modo claro' : 'Usar modo escuro'}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {isDark ? 'Modo claro' : 'Modo escuro'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className={`block mb-2 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`
                w-full px-4 py-3 rounded-xl border transition-all duration-200 focus:ring-2
                ${isDark
                  ? 'bg-slate-800/80 border-slate-700 text-slate-50 placeholder:text-slate-400 focus:ring-indigo-500/60 focus:border-indigo-500'
                  : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-500 focus:ring-blue-500/30 focus:border-blue-500'}
              `}
              placeholder="seu@email.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className={`block mb-2 text-sm font-medium ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
              Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`
                  w-full px-4 py-3 rounded-xl border transition-all duration-200 pr-12 focus:ring-2
                  ${isDark
                    ? 'bg-slate-800/80 border-slate-700 text-slate-50 placeholder:text-slate-400 focus:ring-indigo-500/60 focus:border-indigo-500'
                    : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-500 focus:ring-blue-500/30 focus:border-blue-500'}
                `}
                placeholder="••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`
                  absolute right-3 top-1/2 -translate-y-1/2 transition-colors
                  ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-400 hover:text-gray-600'}
                `}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className={`
                px-4 py-3 rounded-xl border
                ${isDark ? 'bg-red-500/10 border-red-500/30 text-red-100' : 'bg-red-50 border-red-200 text-red-700'}
              `}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`
              w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all duration-200 shadow-lg
              ${isDark
                ? 'bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 text-white shadow-blue-900/40'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-indigo-200'}
              disabled:opacity-60 disabled:cursor-not-allowed
            `}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Entrando...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Entrar
              </>
            )}
            </button>
        </form>

        <div className={`mt-6 text-center text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
          <p>Parceiros: use seu email e os 6 primeiros dígitos do CPF</p>
        </div>

        <div
          className={`
            mt-4 p-4 rounded-xl border text-sm
            ${isDark ? 'bg-slate-800/60 border-white/10 text-slate-100' : 'bg-blue-50 border-blue-200 text-blue-900'}
          `}
        >
          <p className="text-sm">
            <span className="block mb-1">✨ <strong>Primeiro Acesso:</strong></span>
            <span className="block">Email: <strong>admin@sistema.com</strong></span>
            <span className="block">Senha: <strong>admin123</strong></span>
          </p>
        </div>
      </div>
    </div>
  );
}
