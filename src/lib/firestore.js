import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";
import { FRENTE_CONTRATOS_ID } from "./constants";

function frentesRef() {
  return collection(db, "frentes");
}

function itensRef(frenteId) {
  return collection(db, "frentes", frenteId, "itens");
}

function comentariosRef(frenteId, itemId) {
  return collection(db, "frentes", frenteId, "itens", itemId, "comentarios");
}

// ---------- Frentes ----------

export function watchFrentes(uid, callback) {
  const q = query(
    frentesRef(),
    where("membrosUids", "array-contains", uid),
    orderBy("atualizadoEm", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function watchFrente(frenteId, callback) {
  return onSnapshot(doc(db, "frentes", frenteId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function criarFrente({ nome, descricao, cor, uid }) {
  return addDoc(frentesRef(), {
    nome,
    descricao: descricao || "",
    cor: cor || "#009992",
    donoId: uid,
    membros: { [uid]: "proprietario" },
    membrosUids: [uid],
    convitesPendentes: [],
    convitesPendentesEmails: [],
    arquivada: false,
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
}

export async function atualizarFrente(frenteId, dados) {
  return updateDoc(doc(db, "frentes", frenteId), {
    ...dados,
    atualizadoEm: serverTimestamp(),
  });
}

export async function convidarMembro(frenteId, email, papel) {
  return updateDoc(doc(db, "frentes", frenteId), {
    convitesPendentes: arrayUnion({ email, papel }),
    convitesPendentesEmails: arrayUnion(email),
    atualizadoEm: serverTimestamp(),
  });
}

export async function cancelarConvite(frenteId, convite) {
  return updateDoc(doc(db, "frentes", frenteId), {
    convitesPendentes: arrayRemove(convite),
    convitesPendentesEmails: arrayRemove(convite.email),
  });
}

export async function alterarPapel(frenteId, membros, uidDoMembro, novoPapel) {
  return updateDoc(doc(db, "frentes", frenteId), {
    membros: { ...membros, [uidDoMembro]: novoPapel },
    atualizadoEm: serverTimestamp(),
  });
}

export async function removerMembro(frenteId, membros, membrosUids, uidDoMembro) {
  const novoMembros = { ...membros };
  delete novoMembros[uidDoMembro];
  const novoMembrosUids = membrosUids.filter((uid) => uid !== uidDoMembro);
  await sincronizarMembrosNosItens(frenteId, novoMembrosUids);
  return updateDoc(doc(db, "frentes", frenteId), {
    membros: novoMembros,
    membrosUids: novoMembrosUids,
    atualizadoEm: serverTimestamp(),
  });
}

// Resolve convites pendentes do e-mail do usuário logado, em qualquer frente.
// Dá pra usuária entrar numa frente compartilhada sem precisar de Cloud Function.
export async function resgatarConvitesPendentes(uid, email) {
  if (!email) return;
  const q = query(frentesRef(), where("convitesPendentesEmails", "array-contains", email));
  const snap = await getDocs(q);
  for (const frenteDoc of snap.docs) {
    const frente = frenteDoc.data();
    const convite = (frente.convitesPendentes || []).find((c) => c.email === email);
    if (!convite) continue;
    const novosMembros = { ...frente.membros, [uid]: convite.papel };
    const novosMembrosUids = Array.from(new Set([...(frente.membrosUids || []), uid]));
    await updateDoc(frenteDoc.ref, {
      membros: novosMembros,
      membrosUids: novosMembrosUids,
      convitesPendentes: arrayRemove(convite),
      convitesPendentesEmails: arrayRemove(email),
    });
    await sincronizarMembrosNosItens(frenteDoc.id, novosMembrosUids);
  }
}

// Garante que a frente padrão "Contratos" existe e que quem logou é membro
// dela — sem isso não dá pra usar o ID fixo FRENTE_CONTRATOS_ID direto nas
// regras de segurança (que exigem o uid dentro de membrosUids). Primeira
// pessoa a passar por aqui cria a frente; as próximas só entram como editor.
export async function garantirFrenteContratosPadrao(uid) {
  const ref = doc(db, "frentes", FRENTE_CONTRATOS_ID);
  let snap = await getDoc(ref);
  if (!snap.exists()) {
    try {
      await setDoc(ref, {
        nome: "Contratos",
        descricao: "Frente padrão com os itens de cada contrato.",
        cor: "#009992",
        donoId: uid,
        membros: { [uid]: "proprietario" },
        membrosUids: [uid],
        convitesPendentes: [],
        convitesPendentesEmails: [],
        arquivada: false,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp(),
      });
      return;
    } catch {
      // Alguém criou ao mesmo tempo — recarrega e entra como membro abaixo.
      snap = await getDoc(ref);
    }
  }
  const dados = snap.data();
  if (dados && !dados.membrosUids?.includes(uid)) {
    await updateDoc(ref, {
      membros: { ...dados.membros, [uid]: "editor" },
      membrosUids: [...dados.membrosUids, uid],
    });
  }
}

// Itens da frente "Contratos" vinculados a um contrato específico (campo
// contratoVinculado, copiado do ID do contrato na criação pela tela dele).
export function watchItensDoContrato(contratoId, callback) {
  const q = query(itensRef(FRENTE_CONTRATOS_ID), where("contratoVinculado", "==", contratoId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

async function sincronizarMembrosNosItens(frenteId, novosMembrosUids) {
  const snap = await getDocs(itensRef(frenteId));
  await Promise.all(
    snap.docs.map((itemDoc) => updateDoc(itemDoc.ref, { membrosUids: novosMembrosUids }))
  );
}

// Apaga a frente e tudo dentro dela (itens e os comentários de cada item).
export async function excluirFrente(frenteId) {
  const itensSnap = await getDocs(itensRef(frenteId));
  for (const itemDoc of itensSnap.docs) {
    await excluirComentariosDoItem(frenteId, itemDoc.id);
  }
  const batch = writeBatch(db);
  itensSnap.docs.forEach((itemDoc) => batch.delete(itemDoc.ref));
  batch.delete(doc(db, "frentes", frenteId));
  await batch.commit();
}

export async function excluirItem(frenteId, itemId) {
  await excluirComentariosDoItem(frenteId, itemId);
  await deleteDoc(doc(db, "frentes", frenteId, "itens", itemId));
}

async function excluirComentariosDoItem(frenteId, itemId) {
  const snap = await getDocs(comentariosRef(frenteId, itemId));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ---------- Itens ----------

export function watchItens(frenteId, callback, onError) {
  const q = query(itensRef(frenteId), orderBy("criadoEm", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (erro) => {
      console.error("Erro ao observar itens:", erro);
      if (onError) onError(erro);
    }
  );
}

export function watchItem(frenteId, itemId, callback) {
  return onSnapshot(doc(db, "frentes", frenteId, "itens", itemId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export async function criarItem(frenteId, { membrosUids, uid, ...dados }) {
  return addDoc(itensRef(frenteId), {
    tipo: dados.tipo,
    titulo: dados.titulo,
    descricao: dados.descricao || "",
    status: dados.status || null,
    prazo: dados.prazo || null,
    responsavelId: dados.responsavelId || null,
    responsavelNome: dados.responsavelNome || null,
    camposCustom: dados.camposCustom || [],
    tags: dados.tags || [],
    concluido: false,
    concluidoEm: null,
    lembrete: dados.lembrete || null,
    reuniao: dados.reuniao || null,
    contratoVinculado: dados.contratoVinculado || null,
    criadoPor: uid,
    frenteId,
    membrosUids,
    ordem: Date.now(),
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
}

export async function atualizarItem(frenteId, itemId, dados) {
  return updateDoc(doc(db, "frentes", frenteId, "itens", itemId), {
    ...dados,
    atualizadoEm: serverTimestamp(),
  });
}

export async function marcarConcluido(frenteId, itemId, concluido) {
  return updateDoc(doc(db, "frentes", frenteId, "itens", itemId), {
    concluido,
    concluidoEm: concluido ? serverTimestamp() : null,
    atualizadoEm: serverTimestamp(),
  });
}

// ---------- Painel geral (consulta entre frentes) ----------

// Mesma consulta da busca abaixo, mas em tempo real: alimenta o painel, o
// menu lateral, a busca e os contadores, que precisam refletir na hora um
// item concluído ou um lembrete adiado.
export function watchItensAbertosDoUsuario(uid, callback, onError) {
  const q = query(
    collectionGroup(db, "itens"),
    where("membrosUids", "array-contains", uid),
    where("concluido", "==", false),
    orderBy("prazo", "asc")
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (erro) => {
      console.error("Erro ao observar itens abertos:", erro);
      if (onError) onError(erro);
    }
  );
}

// ---------- Lembretes ----------

export async function adiarLembrete(frenteId, itemId, novaData) {
  return atualizarItem(frenteId, itemId, {
    "lembrete.proximaVerificacao": novaData,
    "lembrete.status": "pendente",
  });
}

// "Já tive retorno": encerra o lembrete (o item continua aberto).
export async function encerrarLembrete(frenteId, itemId) {
  return atualizarItem(frenteId, itemId, {
    "lembrete.ativo": false,
    "lembrete.status": "respondido",
  });
}

// ---------- Reuniões ----------

// Marca/desmarca um preparo como feito para a reunião de uma data ("AAAA-MM-DD").
export async function marcarPreparo(frenteId, itemId, chave, preparoId, feito) {
  return atualizarItem(frenteId, itemId, {
    [`reuniao.feitos.${chave}`]: feito ? arrayUnion(preparoId) : arrayRemove(preparoId),
  });
}

// Cancela só a reunião de uma data; a recorrência segue normal.
export async function pularReuniao(frenteId, itemId, chave) {
  return atualizarItem(frenteId, itemId, { "reuniao.puladas": arrayUnion(chave) });
}

export async function buscarItensAbertosDoUsuario(uid) {
  const q = query(
    collectionGroup(db, "itens"),
    where("membrosUids", "array-contains", uid),
    where("concluido", "==", false),
    orderBy("prazo", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
