import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "../firebase";
export { partesDoTexto, localDe } from "./textosNotificacao";

// Notificações dentro do app. Cada aviso é um documento em notificacoes/{id}
// com o destinatário; quem age (autor) cria o aviso no momento da ação.
// Tipos: comentario, mencao, atribuido, aditivo, demanda_criada,
// demanda_priorizada, fila_repriorizada, convite_recebido, convite_aceito.

export const DIAS_GUARDADAS = 60;

function notificacoesRef() {
  return collection(db, "notificacoes");
}

// Cria o mesmo aviso para vários destinatários (sem repetir e sem avisar o
// próprio autor). `porDestinatario(uid)` pode ajustar campos por pessoa
// (ex.: "sua fila" para a dona e "fila de Fulano" para os demais).
export async function notificar(destinatarios, aviso, porDestinatario) {
  const autor = auth.currentUser;
  if (!autor) return;
  const unicos = Array.from(new Set(destinatarios.filter(Boolean))).filter((uid) => uid !== autor.uid);
  if (unicos.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const uid of unicos) {
      batch.set(doc(notificacoesRef()), {
        destinatarioId: uid,
        autorId: autor.uid,
        autorNome: autor.displayName || autor.email || "Alguém",
        autorFoto: autor.photoURL || "",
        tipo: aviso.tipo,
        alvo: aviso.alvo || "",
        contexto: aviso.contexto || "",
        trecho: (aviso.trecho || "").slice(0, 300),
        link: aviso.link || "/dashboard",
        lida: false,
        criadoEm: serverTimestamp(),
        ...(porDestinatario ? porDestinatario(uid) : {}),
      });
    }
    await batch.commit();
  } catch (erro) {
    // Notificar é complementar: se falhar, a ação principal continua valendo.
    console.error("Erro ao criar notificações:", erro);
  }
}

// Aviso para a própria pessoa (ex.: "Fulano compartilhou X com você", gerado
// no login de quem foi convidada). O nome exibido é o de quem compartilhou.
export async function notificarASiMesmo(aviso, comoSeFosse) {
  const eu = auth.currentUser;
  if (!eu) return;
  try {
    const batch = writeBatch(db);
    batch.set(doc(notificacoesRef()), {
      destinatarioId: eu.uid,
      autorId: eu.uid,
      autorNome: comoSeFosse?.nome || "Alguém",
      autorFoto: comoSeFosse?.foto || "",
      tipo: aviso.tipo,
      alvo: aviso.alvo || "",
      contexto: aviso.contexto || "",
      trecho: (aviso.trecho || "").slice(0, 300),
      link: aviso.link || "/dashboard",
      lida: false,
      criadoEm: serverTimestamp(),
    });
    await batch.commit();
  } catch (erro) {
    console.error("Erro ao criar notificação:", erro);
  }
}

export async function perfilDe(uid) {
  try {
    const snap = await getDoc(doc(db, "usuarios", uid));
    return snap.exists() ? { nome: snap.data().nome, foto: snap.data().avatarUrl } : null;
  } catch {
    return null;
  }
}

export function watchNotificacoes(uid, callback, onError) {
  const q = query(notificacoesRef(), where("destinatarioId", "==", uid), orderBy("criadoEm", "desc"), limit(100));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (erro) => {
      console.error("Erro ao observar notificações:", erro);
      if (onError) onError(erro);
    }
  );
}

export async function marcarLidas(ids) {
  if (!ids.length) return;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, "notificacoes", id), { lida: true }));
  await batch.commit();
}

// Apaga as notificações mais antigas que DIAS_GUARDADAS (chamado ao entrar).
export async function limparNotificacoesAntigas(uid) {
  const corte = new Date();
  corte.setDate(corte.getDate() - DIAS_GUARDADAS);
  const q = query(notificacoesRef(), where("destinatarioId", "==", uid), where("criadoEm", "<", corte), limit(200));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

export function quandoFoi(valor, agora = new Date()) {
  if (!valor) return "agora";
  const data = valor.toDate ? valor.toDate() : new Date(valor);
  const min = Math.floor((agora - data) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  const mesmoDia = data.toDateString() === agora.toDateString();
  if (mesmoDia) return `há ${h} h`;
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  const hora = data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (data.toDateString() === ontem.toDateString()) return `ontem, ${hora}`;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + `, ${hora}`;
}

export function ehDeHoje(valor, agora = new Date()) {
  if (!valor) return true;
  const data = valor.toDate ? valor.toDate() : new Date(valor);
  return data.toDateString() === agora.toDateString();
}

// Aviso para quem tem acesso a uma fila de demandas (dona e membros). O
// contexto fica "sua fila" para a dona e "fila de Fulano" para os demais.
export function notificarFila(donoId, fila, aviso) {
  const destinatarios = [donoId, ...(fila?.membrosUids || [])];
  const nomeDono = fila?.donoNome || "outra pessoa";
  return notificar(destinatarios, aviso, (uid) => ({
    contexto: uid === donoId ? "sua fila" : `fila de ${nomeDono}`,
  }));
}

// Convite resgatado no login: avisa a própria pessoa ("Fulano compartilhou X
// com você") e quem convidou (a proprietária, única que pode convidar).
export async function avisarConviteResgatado({ donoId, contexto, alvo, linkConvidada, linkDona }) {
  if (!donoId) return;
  const dona = await perfilDe(donoId);
  await notificarASiMesmo({ tipo: "convite_recebido", contexto, alvo, link: linkConvidada }, dona);
  await notificar([donoId], { tipo: "convite_aceito", alvo, link: linkDona });
}

export function proprietarioDe(membros) {
  return Object.keys(membros || {}).find((uid) => membros[uid] === "proprietario") || null;
}
