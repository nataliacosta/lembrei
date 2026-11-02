import { createContext, useContext, useEffect, useState } from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, firebaseConfigurado, googleProvider } from "../firebase";
import { garantirFrenteContratosPadrao, resgatarConvitesPendentes } from "../lib/firestore";
import { resgatarConvitesPendentesContratos } from "../lib/contratos";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function ensureUserDoc(firebaseUser) {
    const ref = doc(db, "usuarios", firebaseUser.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        nome: firebaseUser.displayName || firebaseUser.email,
        email: firebaseUser.email,
        avatarUrl: firebaseUser.photoURL || "",
        criadoEm: serverTimestamp(),
      });
    }
  }

  useEffect(() => {
    if (!firebaseConfigurado) {
      setLoading(false);
      return;
    }
    // Processa o retorno do signInWithRedirect, se houver, antes de tudo.
    getRedirectResult(auth).catch((e) => console.error("Erro no redirect de login:", e));

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Essas duas tarefas são "de apoio" (criar o perfil, resgatar convites
        // pendentes) — se qualquer uma falhar, a pessoa ainda assim deve
        // conseguir entrar no app. Erro aqui só vai pro console, nunca bloqueia
        // o login.
        try {
          await ensureUserDoc(firebaseUser);
        } catch (e) {
          console.error("Falha ao criar/verificar o perfil do usuário:", e);
        }
        try {
          await resgatarConvitesPendentes(firebaseUser.uid, firebaseUser.email);
        } catch (e) {
          console.error("Falha ao resgatar convites pendentes:", e);
        }
        try {
          await resgatarConvitesPendentesContratos(firebaseUser.uid, firebaseUser.email);
        } catch (e) {
          console.error("Falha ao resgatar convites pendentes de contratos:", e);
        }
        try {
          await garantirFrenteContratosPadrao(firebaseUser.uid);
        } catch (e) {
          console.error("Falha ao garantir a frente padrão de contratos:", e);
        }
      }
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signInWithGoogle() {
    await signInWithRedirect(auth, googleProvider);
  }

  async function signOut() {
    await firebaseSignOut(auth);
  }

  const value = { user, loading, signInWithGoogle, signOut };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
