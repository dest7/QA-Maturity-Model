import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Target, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Логотип */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/10 mb-4">
            <Target size={32} />
          </div>
          <h1 className="text-3xl font-extrabold font-display tracking-tight text-foreground">QA Maturity</h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest font-semibold">Dashboard</p>
        </div>

        {/* Карточка формы */}
        <div className="bg-card/60 border border-border/50 rounded-3xl p-8 shadow-2xl shadow-black/40 backdrop-blur-md">
          <h2 className="text-xl font-bold font-display mb-1 text-foreground">Вход в систему</h2>
          <p className="text-sm text-muted-foreground mb-6">Введите корпоративный email и пароль</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="user@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background/60 border-border/60 h-11 text-sm focus:border-primary/60"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Пароль
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-background/60 border-border/60 h-11 text-sm focus:border-primary/60 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3"
              >
                <span>{error}</span>
              </motion.div>
            )}

            <Button
              type="submit"
              disabled={isLoading || !email || !password}
              className="h-11 mt-1 font-semibold"
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isLoading ? "Входим..." : "Войти"}
            </Button>
          </form>
        </div>

        {/* Тестовые учётные данные */}
        <div className="mt-6 bg-card/30 border border-border/30 rounded-2xl p-5 backdrop-blur-sm">
          <p className="text-[11px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-3">Тестовые пользователи</p>
          <div className="grid grid-cols-1 gap-2">
            {[
              { name: "Edward (Admin)", email: "edward@company.com", password: "Edward" },
              { name: "Anna (Viewer)", email: "anna@company.com", password: "Anna" },
              { name: "Boris (Contributor)", email: "boris@company.com", password: "Boris" },
              { name: "Clara (Reviewer)", email: "clara@company.com", password: "Clara" },
              { name: "Igor (Manager)", email: "igor@company.com", password: "Igor" },
            ].map(({ name, email: e, password: p }) => (
              <button
                key={e}
                type="button"
                onClick={() => { setEmail(e); setPassword(p); setError(null); }}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all text-xs",
                  email === e
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border/20 bg-background/20 text-muted-foreground hover:bg-background/40 hover:border-border/40"
                )}
              >
                <span className="font-medium">{name}</span>
                <span className="font-mono opacity-50">{e}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
