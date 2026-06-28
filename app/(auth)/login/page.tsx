"use client";

import { useState } from "react";
import { signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { LogIn, Mail, Lock, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

const minPasswordLength = 6; //Questo è un controllo solo a livello UI


export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);  // true = login, false = register
  const [email, setEmail] = useState(""); //stato email per il form di login/registrazione
  const [password, setPassword] = useState(""); //stato password per il form di login/registrazione
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);  //quando è in corso l'autenticazione (true) vengono disattivati i pulsanti

  //Casistiche errore firebase auth
  const getFirebaseErrorMessage = (err: unknown): string => {
    console.error("Errore originale Firebase Auth:", err);
    const code = (err as { code?: string }).code;
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Credenziali non valide. Controlla email e password e riprova.";
      case "auth/email-already-in-use":
        return "Questo indirizzo email è già associato a un account.";
      case "auth/invalid-email":
        return "L'indirizzo email inserito non è valido.";
      case "auth/weak-password":
        return "La password deve contenere almeno 6 caratteri.";
      case "auth/too-many-requests":
        return "Troppi tentativi di accesso non riusciti. L'accesso per questo account è temporaneamente disabilitato. Riprova più tardi.";
      case "auth/user-disabled":
        return "Questo account è stato disabilitato.";
      default:
        return (err as { message?: string }).message || "Si è verificato un errore durante l'autenticazione. Riprova.";
    }
  };

  //Login e registrazione con email e password
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!isLogin && password.length < minPasswordLength) {
      setError(`La password deve contenere almeno ${minPasswordLength} caratteri.`); //Questo messaggio non dovrebbe mai uscire, se il controllo del campo HTML funziona
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        console.log("Invio credenziali di login a Firebase Auth:", { email });
        await signInWithEmailAndPassword(auth, email, password);
        console.log("Login con email avvenuto con successo");
        router.push("/redirect-login");
      } else {
        console.log("Invio credenziali di registrazione a Firebase Auth:", { email });
        await createUserWithEmailAndPassword(auth, email, password);
        console.log("Registrazione mediante email avvenuta con successo");
        router.push("/redirect-login");
      }
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  //Reset password
  const handleResetPassword = async () => {
    setError(null);
    setMessage(null);
    if (!email) {
      setError("Inserisci il tuo indirizzo email nel campo apposito per reimpostare la password.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Email per il reset della password inviata! Controlla la tua casella di posta.");
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  //GoogleAuth
  const handleGoogleSignIn = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    console.log("Avvio del login con Google tramite popup pagina esterna");
    try {
      await signInWithPopup(auth, googleProvider);
      console.log("Login con Google è avvenuto con successo");
      router.push("/redirect-login")
    } catch (err: unknown) {
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 sm:p-10 shadow-sm transition-all hover:shadow-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4 text-green-600 dark:text-green-500">
            <LogIn className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {isLogin ? "Benvenuto" : "Crea il tuo account"}
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-2">
            {isLogin ? "Accedi per accedere alla tua dispensa" : "Iscriviti per iniziare a organizzare"}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <p className="text-sm text-green-800 dark:text-green-200">{message}</p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-1">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 ml-1">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-zinc-400" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required //Validazione email HTML
                className="block w-full pl-11 pr-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl leading-5 bg-zinc-50 dark:bg-zinc-950 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors text-zinc-900 dark:text-zinc-100"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</label>
              {isLogin && (
                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={loading}
                  className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-green-600 dark:hover:text-green-500 hover:underline focus:outline-none transition-colors disabled:opacity-50 disabled:hover:no-underline"
                >
                  Hai dimenticato la password?
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-zinc-400" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={minPasswordLength}
                required //Validazione minimo lunghezza password 
                className="block w-full pl-11 pr-12 py-3 border border-zinc-200 dark:border-zinc-800 rounded-2xl leading-5 bg-zinc-50 dark:bg-zinc-950 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-colors text-zinc-900 dark:text-zinc-100"
                placeholder="*******"
              />
              <button
                type="button"
                onClick={() => setShowPassword((currentValue) => !currentValue)}
                aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl shadow-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : isLogin ? "Accedi" : "Iscriviti"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between">
          <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1"></div>
          <span className="px-4 text-sm text-zinc-400">Oppure continua con</span>
          <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-1"></div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          type="button"
          disabled={loading}
          className="mt-6 w-full flex items-center justify-center gap-3 py-3 px-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-900 dark:text-zinc-100 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            <path fill="none" d="M1 1h22v22H1z" />
          </svg>
          Google
        </button>

        <div className="mt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {isLogin ? "Non hai un account? " : "Hai già un account? "}
          <button onClick={() => setIsLogin(!isLogin)} className="font-medium text-green-600 dark:text-green-500 hover:underline focus:outline-none">
            {isLogin ? "Iscriviti" : "Accedi"}
          </button>
        </div>
      </div>
    </div>
  );
}
