import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { avisarConviteResgatado, proprietarioDe } from "./notificacoes";
import { resumoDaVersao } from "./orcamentos";

// Planejamentos (um por ano, compartilhado), versões e o conteúdo de cada versão.
const planejamentosRef = () => collection(db, "planejamentos");
const versoesRef = (pid) => collection(db, "planejamentos", pid, "versoes");
const conteudoRef = (pid, vid) => doc(db, "planejamentos", pid, "versoes", vid, "conteudo", "principal");

function lista(snap) {
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function watchPlanejamentos(uid, callback, onError) {
  return onSnapshot(
    query(planejamentosRef(), where("membrosUids", "array-contains", uid)),
    (snap) => callback(lista(snap).sort((a, b) => b.ano - a.ano)),
    (e) => {
      console.error("Erro ao observar orçamentos:", e);
      onError?.(e);
    }
  );
}

export function watchPlanejamento(pid, callback) {
  return onSnapshot(
    doc(db, "planejamentos", pid),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (e) => {
      console.error(e);
      callback(null);
    }
  );
}

export function watchVersoes(pid, callback) {
  return onSnapshot(versoesRef(pid), (snap) => callback(lista(snap)), (e) => console.error("Erro ao observar versões:", e));
}

export function watchVersao(pid, vid, callback) {
  return onSnapshot(
    doc(db, "planejamentos", pid, "versoes", vid),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (e) => {
      console.error(e);
      callback(null);
    }
  );
}

export function watchConteudo(pid, vid, callback) {
  return onSnapshot(
    conteudoRef(pid, vid),
    (snap) => callback(snap.exists() ? snap.data() : { completa: [], condensada: [], extras: {} }),
    (e) => {
      console.error(e);
      callback(null);
    }
  );
}

export async function lerConteudo(pid, vid) {
  const snap = await getDoc(conteudoRef(pid, vid));
  return snap.exists() ? snap.data() : { completa: [], condensada: [], extras: {} };
}

export async function lerVersoes(pid) {
  return lista(await getDocs(versoesRef(pid)));
}

export async function criarPlanejamento(ano, user) {
  const r = await addDoc(planejamentosRef(), {
    ano: Number(ano),
    donoId: user.uid,
    membros: { [user.uid]: "proprietario" },
    membrosUids: [user.uid],
    convitesPendentes: [],
    convitesPendentesEmails: [],
    criadoEm: serverTimestamp(),
  });
  return r.id;
}

// Cria a versão já com o conteúdo, e o resumo (totais) gravado nela.
export async function criarVersao(pid, dados, conteudo, user) {
  const versaoRef = doc(versoesRef(pid));
  const base = { ...dados, criadoPor: user.uid, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp() };
  const batch = writeBatch(db);
  batch.set(versaoRef, { ...base, ...resumoDaVersao(dados, conteudo) });
  batch.set(conteudoRef(pid, versaoRef.id), { completa: conteudo.completa || [], condensada: conteudo.condensada || [], extras: conteudo.extras || {} });
  await batch.commit();
  return versaoRef.id;
}

export function atualizarVersao(pid, vid, dados) {
  return updateDoc(doc(db, "planejamentos", pid, "versoes", vid), { ...dados, atualizadoEm: serverTimestamp() });
}

// Grava o conteúdo (linhas e extras) e atualiza os totais da versão.
export async function salvarConteudo(pid, vid, versao, conteudo) {
  const batch = writeBatch(db);
  batch.set(conteudoRef(pid, vid), { completa: conteudo.completa || [], condensada: conteudo.condensada || [], extras: conteudo.extras || {} });
  batch.update(doc(db, "planejamentos", pid, "versoes", vid), { ...resumoDaVersao(versao, conteudo), atualizadoEm: serverTimestamp() });
  await batch.commit();
}

export async function excluirVersao(pid, vid) {
  const batch = writeBatch(db);
  batch.delete(conteudoRef(pid, vid));
  batch.delete(doc(db, "planejamentos", pid, "versoes", vid));
  await batch.commit();
}

export async function excluirPlanejamento(pid) {
  const versoes = await getDocs(versoesRef(pid));
  for (const v of versoes.docs) await excluirVersao(pid, v.id);
  await deleteDoc(doc(db, "planejamentos", pid));
}

// ---------- Compartilhar (por ano, como os contratos) ----------

export function convidarMembroPlanejamento(pid, email, papel) {
  return updateDoc(doc(db, "planejamentos", pid), {
    convitesPendentes: arrayUnion({ email, papel }),
    convitesPendentesEmails: arrayUnion(email),
  });
}

export function cancelarConvitePlanejamento(pid, convite) {
  return updateDoc(doc(db, "planejamentos", pid), {
    convitesPendentes: arrayRemove(convite),
    convitesPendentesEmails: arrayRemove(convite.email),
  });
}

export function alterarPapelPlanejamento(pid, membros, uid, papel) {
  return updateDoc(doc(db, "planejamentos", pid), { membros: { ...membros, [uid]: papel } });
}

export function removerMembroPlanejamento(pid, membros, membrosUids, uid) {
  const novos = { ...membros };
  delete novos[uid];
  return updateDoc(doc(db, "planejamentos", pid), { membros: novos, membrosUids: membrosUids.filter((u) => u !== uid) });
}

export async function resgatarConvitesPendentesPlanejamentos(uid, email) {
  if (!email) return;
  const snap = await getDocs(query(planejamentosRef(), where("convitesPendentesEmails", "array-contains", email)));
  for (const d of snap.docs) {
    const p = d.data();
    const convite = (p.convitesPendentes || []).find((c) => c.email === email);
    if (!convite) continue;
    await updateDoc(d.ref, {
      membros: { ...p.membros, [uid]: convite.papel },
      membrosUids: Array.from(new Set([...(p.membrosUids || []), uid])),
      convitesPendentes: arrayRemove(convite),
      convitesPendentesEmails: arrayRemove(email),
    });
    await avisarConviteResgatado({
      donoId: proprietarioDe(p.membros),
      contexto: "o orçamento",
      alvo: `Orçamento ${p.ano}`,
      linkConvidada: `/orcamentos/${d.id}`,
      linkDona: `/orcamentos/${d.id}/compartilhar`,
    });
  }
}
