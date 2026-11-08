import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { avisarConviteResgatado, proprietarioDe } from "./notificacoes";

function contratosRef() {
  return collection(db, "contratos");
}

function aditivosRef(contratoId) {
  return collection(db, "contratos", contratoId, "aditivos");
}

function cancelamentosRef(contratoId) {
  return collection(db, "contratos", contratoId, "cancelamentos");
}

// ---------- Contratos ----------

export function watchContratos(uid, callback, onError) {
  const q = query(contratosRef(), where("membrosUids", "array-contains", uid), orderBy("vencimento", "asc"));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (erro) => {
      console.error("Erro ao observar contratos:", erro);
      if (onError) onError(erro);
    }
  );
}

export function watchContrato(contratoId, callback) {
  return onSnapshot(doc(db, "contratos", contratoId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function criarContrato({ titulo, numero, fornecedor, escopo, vencimento, medicao, uid }) {
  return addDoc(contratosRef(), {
    titulo,
    medicao: medicao || null,
    numero: numero || "",
    fornecedor: fornecedor || "",
    escopo: escopo || "",
    vencimento: vencimento || null,
    status: "ativo",
    donoId: uid,
    membros: { [uid]: "proprietario" },
    membrosUids: [uid],
    convitesPendentes: [],
    convitesPendentesEmails: [],
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
}

export async function atualizarContrato(contratoId, dados) {
  return updateDoc(doc(db, "contratos", contratoId), {
    ...dados,
    atualizadoEm: serverTimestamp(),
  });
}

export async function excluirContrato(contratoId) {
  const subcolecoes = ["aditivos", "cancelamentos", "centros", "equipes", "recursos", "medicoes"];
  const snaps = await Promise.all(subcolecoes.map((s) => getDocs(collection(db, "contratos", contratoId, s))));
  // Em lotes de até 450 (o limite do Firestore é 500 por lote).
  const refs = snaps.flatMap((snap) => snap.docs.map((d) => d.ref));
  for (let i = 0; i < refs.length; i += 450) {
    const lote = writeBatch(db);
    refs.slice(i, i + 450).forEach((r) => lote.delete(r));
    await lote.commit();
  }
  await writeBatch(db).delete(doc(db, "contratos", contratoId)).commit();
}

export async function convidarMembroContrato(contratoId, email, papel) {
  return updateDoc(doc(db, "contratos", contratoId), {
    convitesPendentes: arrayUnion({ email, papel }),
    convitesPendentesEmails: arrayUnion(email),
    atualizadoEm: serverTimestamp(),
  });
}

export async function cancelarConviteContrato(contratoId, convite) {
  return updateDoc(doc(db, "contratos", contratoId), {
    convitesPendentes: arrayRemove(convite),
    convitesPendentesEmails: arrayRemove(convite.email),
  });
}

export async function alterarPapelContrato(contratoId, membros, uidDoMembro, novoPapel) {
  return updateDoc(doc(db, "contratos", contratoId), {
    membros: { ...membros, [uidDoMembro]: novoPapel },
    atualizadoEm: serverTimestamp(),
  });
}

export async function removerMembroContrato(contratoId, membros, membrosUids, uidDoMembro) {
  const novoMembros = { ...membros };
  delete novoMembros[uidDoMembro];
  const novoMembrosUids = membrosUids.filter((uid) => uid !== uidDoMembro);
  await sincronizarMembrosNosAditivos(contratoId, novoMembrosUids);
  return updateDoc(doc(db, "contratos", contratoId), {
    membros: novoMembros,
    membrosUids: novoMembrosUids,
    atualizadoEm: serverTimestamp(),
  });
}

export async function resgatarConvitesPendentesContratos(uid, email) {
  if (!email) return;
  const q = query(contratosRef(), where("convitesPendentesEmails", "array-contains", email));
  const snap = await getDocs(q);
  for (const contratoDoc of snap.docs) {
    const contrato = contratoDoc.data();
    const convite = (contrato.convitesPendentes || []).find((c) => c.email === email);
    if (!convite) continue;
    const novosMembros = { ...contrato.membros, [uid]: convite.papel };
    const novosMembrosUids = Array.from(new Set([...(contrato.membrosUids || []), uid]));
    await updateDoc(contratoDoc.ref, {
      membros: novosMembros,
      membrosUids: novosMembrosUids,
      convitesPendentes: arrayRemove(convite),
      convitesPendentesEmails: arrayRemove(email),
    });
    await sincronizarMembrosNosAditivos(contratoDoc.id, novosMembrosUids);
    await avisarConviteResgatado({
      donoId: proprietarioDe(contrato.membros),
      contexto: "o contrato",
      alvo: contrato.titulo,
      linkConvidada: `/contratos/${contratoDoc.id}`,
      linkDona: `/contratos/${contratoDoc.id}/compartilhar`,
    });
  }
}

async function sincronizarMembrosNosAditivos(contratoId, novosMembrosUids) {
  // Aditivos e itens do contrato ficam visíveis para quem tem acesso a ele.
  const [aditivos, itens] = await Promise.all([getDocs(aditivosRef(contratoId)), getDocs(collection(db, "contratos", contratoId, "itens"))]);
  await Promise.all([...aditivos.docs, ...itens.docs].map((d) => updateDoc(d.ref, { membrosUids: novosMembrosUids })));
}

// ---------- Aditivos ----------

export function watchAditivos(contratoId, callback) {
  const q = query(aditivosRef(contratoId), orderBy("criadoEm", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

// Cria o aditivo e já põe o contrato em "aditivo em andamento", numa escrita só.
export async function criarAditivo(contratoId, { membrosUids, uid, ...dados }) {
  const batch = writeBatch(db);
  const novoRef = doc(aditivosRef(contratoId));
  batch.set(novoRef, {
    dataSolicitacao: dados.dataSolicitacao || null,
    pendenteEm: dados.pendenteEm,
    tipo: dados.tipo || [],
    numeroRQS: dados.numeroRQS || "",
    ticketLightPlus: dados.ticketLightPlus || "",
    motivo: dados.motivo || "",
    finalizado: false,
    finalizadoEm: null,
    criadoPor: uid,
    contratoId,
    membrosUids,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  batch.update(doc(db, "contratos", contratoId), {
    status: "aditivo",
    // Cópia do "pendente em" do aditivo ativo, pra lista de contratos não
    // precisar consultar os aditivos de cada um só pra mostrar isso.
    aditivoAtivoPendenteEm: dados.pendenteEm,
    atualizadoEm: serverTimestamp(),
  });
  await batch.commit();
  return novoRef;
}

export function watchAditivo(contratoId, aditivoId, callback) {
  return onSnapshot(doc(db, "contratos", contratoId, "aditivos", aditivoId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function atualizarAditivo(contratoId, aditivoId, dados) {
  return updateDoc(doc(db, "contratos", contratoId, "aditivos", aditivoId), {
    ...dados,
    atualizadoEm: serverTimestamp(),
  });
}

// Finaliza o aditivo ativo e devolve o contrato pra "ativo".
export async function finalizarAditivo(contratoId, aditivoId) {
  const batch = writeBatch(db);
  batch.update(doc(db, "contratos", contratoId, "aditivos", aditivoId), {
    finalizado: true,
    finalizadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  batch.update(doc(db, "contratos", contratoId), {
    status: "ativo",
    aditivoAtivoPendenteEm: null,
    atualizadoEm: serverTimestamp(),
  });
  await batch.commit();
}

// ---------- Cancelamentos ----------

export function watchCancelamentos(contratoId, callback) {
  const q = query(cancelamentosRef(contratoId), orderBy("criadoEm", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function criarCancelamento(contratoId, { uid, motivo, dataSolicitacao }) {
  const batch = writeBatch(db);
  const novoRef = doc(cancelamentosRef(contratoId));
  batch.set(novoRef, {
    dataSolicitacao: dataSolicitacao || null,
    motivo: motivo || "",
    finalizado: false,
    finalizadoEm: null,
    criadoPor: uid,
    contratoId,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  batch.update(doc(db, "contratos", contratoId), { status: "cancelamento", atualizadoEm: serverTimestamp() });
  await batch.commit();
  return novoRef;
}

// Finaliza o cancelamento: o contrato passa a "cancelado" de vez.
export async function finalizarCancelamento(contratoId, cancelamentoId) {
  const batch = writeBatch(db);
  batch.update(doc(db, "contratos", contratoId, "cancelamentos", cancelamentoId), {
    finalizado: true,
    finalizadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  batch.update(doc(db, "contratos", contratoId), { status: "cancelado", atualizadoEm: serverTimestamp() });
  await batch.commit();
}

// ---------- Painel geral (consultas entre contratos) ----------

export async function buscarAditivosPendentesTI(uid) {
  const q = query(
    collectionGroup(db, "aditivos"),
    where("membrosUids", "array-contains", uid),
    where("pendenteEm", "==", "TI"),
    where("finalizado", "==", false),
    orderBy("dataSolicitacao", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, contratoId: d.ref.parent.parent?.id, ...d.data() }));
}

// Medição mensal (ver lib/medicao.js): marca o mês como feito ou desfaz.
export async function marcarMedicaoFeita(contratoId, chave, feita = true) {
  return updateDoc(doc(db, "contratos", contratoId), {
    [`medicao.feitas.${chave}`]: feita ? true : deleteField(),
    atualizadoEm: serverTimestamp(),
  });
}
