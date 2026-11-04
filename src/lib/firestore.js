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
import { avisarConviteResgatado, proprietarioDe } from "./notificacoes";
import { FRENTE_CONTRATOS_LEGADA, idFrenteContratos } from "./constants";

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
    await avisarConviteResgatado({
      donoId: frente.donoId || proprietarioDe(frente.membros),
      contexto: "a frente",
      alvo: frente.nome,
      linkConvidada: `/frentes/${frenteDoc.id}`,
      linkDona: `/frentes/${frenteDoc.id}/compartilhar`,
    });
  }
}

// Cada pessoa tem a própria frente "Contratos" (contratos-<uid>), onde caem os
// itens que ela cria a partir da tela de um contrato. Antes existia uma única
// frente compartilhada ("contratos-padrao") em que todo mundo entrava como
// editor ao fazer login — quem a criou continua usando ela (sem mover nada),
// e as demais pessoas saem dela levando os próprios itens.
// Devolve o ID da frente Contratos de quem logou.
export async function garantirFrenteContratos(uid) {
  let legadaEhMinha = false;
  let legada = null;
  try {
    const snap = await getDoc(doc(db, "frentes", FRENTE_CONTRATOS_LEGADA));
    if (snap.exists()) {
      legada = snap.data();
      legadaEhMinha = legada.donoId === uid;
    }
  } catch {
    // Sem permissão para ler: a frente antiga não é minha e já não faço parte dela.
  }

  if (legadaEhMinha) {
    await fecharFrenteLegada(uid, legada);
    return FRENTE_CONTRATOS_LEGADA;
  }

  const id = idFrenteContratos(uid);
  const ref = doc(db, "frentes", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      nome: "Contratos",
      descricao: "Itens criados a partir dos seus contratos.",
      cor: "#009992",
      donoId: uid,
      membros: { [uid]: "proprietario" },
      membrosUids: [uid],
      convitesPendentes: [],
      convitesPendentesEmails: [],
      arquivada: false,
      contratosDe: uid,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
  }
  try {
    await sairDaFrenteLegada(uid, id, legada);
  } catch (e) {
    console.error("Falha ao sair da frente Contratos antiga:", e);
  }
  return id;
}

// Dona da frente antiga: tira as outras pessoas da frente e dos itens. Itens
// criados por outra pessoa continuam visíveis para ela (até ela levar os
// itens para a frente Contratos dela, no próximo login).
async function fecharFrenteLegada(uid, legada) {
  const outros = (legada.membrosUids || []).filter((m) => m !== uid);
  if (outros.length === 0) return;
  const snap = await getDocs(itensRef(FRENTE_CONTRATOS_LEGADA));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    const autor = d.data().criadoPor;
    batch.update(d.ref, { membrosUids: autor && autor !== uid ? [uid, autor] : [uid] });
  });
  batch.update(doc(db, "frentes", FRENTE_CONTRATOS_LEGADA), {
    membros: { [uid]: "proprietario" },
    membrosUids: [uid],
    atualizadoEm: serverTimestamp(),
  });
  await batch.commit();
}

// Outras pessoas: levam os itens que criaram (com os comentários) para a
// própria frente Contratos e saem da frente antiga.
async function sairDaFrenteLegada(uid, minhaFrenteId, legada) {
  // Itens da frente antiga que ainda me incluem (pela consulta do painel, que
  // funciona mesmo quando já não sou membro da frente).
  const consultas = [false, true].map((concluido) =>
    getDocs(
      query(collectionGroup(db, "itens"), where("membrosUids", "array-contains", uid), where("concluido", "==", concluido), orderBy("prazo", "asc"))
    )
  );
  const docs = (await Promise.all(consultas))
    .flatMap((s) => s.docs)
    .filter((d) => d.ref.parent.parent?.id === FRENTE_CONTRATOS_LEGADA);

  for (const d of docs) {
    const item = d.data();
    if (item.criadoPor === uid) {
      const novoRef = doc(db, "frentes", minhaFrenteId, "itens", d.id);
      await setDoc(novoRef, { ...item, frenteId: minhaFrenteId, membrosUids: [uid] });
      const comentarios = await getDocs(collection(d.ref, "comentarios"));
      for (const c of comentarios.docs) {
        await setDoc(doc(novoRef, "comentarios", c.id), c.data());
      }
      await deleteDoc(d.ref);
    } else {
      await updateDoc(d.ref, { membrosUids: (item.membrosUids || []).filter((m) => m !== uid) });
    }
  }

  if (legada?.membrosUids?.includes(uid)) {
    const membros = { ...legada.membros };
    delete membros[uid];
    await updateDoc(doc(db, "frentes", FRENTE_CONTRATOS_LEGADA), {
      membros,
      membrosUids: legada.membrosUids.filter((m) => m !== uid),
    });
  }
}

// Itens da minha frente "Contratos" vinculados a um contrato específico
// (campo contratoVinculado, copiado do ID do contrato na criação pela tela dele).
export function watchItensDoContrato(frenteContratosId, contratoId, callback) {
  const q = query(itensRef(frenteContratosId), where("contratoVinculado", "==", contratoId));
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
