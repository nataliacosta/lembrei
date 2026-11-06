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
import { baseDoContrato, caminhoDoItem, colecaoDeItens, contratoDaBase } from "./itens";

function frentesRef() {
  return collection(db, "frentes");
}

// `frenteId` aqui é a "base" do item: o ID da frente ou "contrato:<id>"
// (ver lib/itens.js).
function itensRef(frenteId) {
  return collection(db, ...colecaoDeItens(frenteId));
}

function comentariosRef(frenteId, itemId) {
  return collection(db, ...caminhoDoItem(frenteId, itemId), "comentarios");
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

// Os itens de contrato moram dentro do contrato (contratos/{id}/itens, ver
// lib/itens.js). Antes eles ficavam numa frente "Contratos" (a antiga
// compartilhada "contratos-padrao" ou a "contratos-<uid>" de cada pessoa).
// No login, os itens dessas frentes ligados a um contrato que a pessoa pode
// editar vão (com os comentários) para dentro do contrato; a frente antiga
// some se ficar vazia (ou a pessoa sai dela, se não for a dona).
export async function levarItensParaOsContratos(uid) {
  const idsAntigos = [FRENTE_CONTRATOS_LEGADA, idFrenteContratos(uid)];
  const frentesAntigas = [];
  for (const id of idsAntigos) {
    try {
      const snap = await getDoc(doc(db, "frentes", id));
      if (snap.exists() && snap.data().membrosUids?.includes(uid)) frentesAntigas.push({ id, ...snap.data() });
    } catch {
      // Sem acesso a essa frente: nada a fazer nela.
    }
  }

  const candidatos = new Map();
  for (const f of frentesAntigas) {
    (await getDocs(itensRef(f.id))).docs.forEach((d) => candidatos.set(d.ref.path, d));
  }
  // Itens da frente antiga que ainda me incluem, mesmo que eu já não seja membro dela.
  const consultas = await Promise.all(
    [false, true].map((concluido) =>
      getDocs(query(collectionGroup(db, "itens"), where("membrosUids", "array-contains", uid), where("concluido", "==", concluido), orderBy("prazo", "asc")))
    )
  );
  consultas
    .flatMap((s) => s.docs)
    .filter((d) => d.ref.parent.parent?.parent?.id === "frentes" && idsAntigos.includes(d.ref.parent.parent.id))
    .forEach((d) => candidatos.set(d.ref.path, d));

  const contratos = {};
  for (const d of candidatos.values()) {
    const item = d.data();
    const contratoId = item.contratoVinculado;
    if (!contratoId) continue;
    if (!(contratoId in contratos)) {
      try {
        const snap = await getDoc(doc(db, "contratos", contratoId));
        contratos[contratoId] = snap.exists() ? snap.data() : null;
      } catch {
        contratos[contratoId] = null;
      }
    }
    const contrato = contratos[contratoId];
    if (!contrato || !["proprietario", "editor"].includes(contrato.membros?.[uid])) continue;
    const base = baseDoContrato(contratoId);
    const novoRef = doc(db, ...caminhoDoItem(base, d.id));
    await setDoc(novoRef, { ...item, frenteId: base, contratoId, aditivoId: item.aditivoId || null, membrosUids: contrato.membrosUids || [uid] });
    for (const c of (await getDocs(collection(d.ref, "comentarios"))).docs) {
      await setDoc(doc(novoRef, "comentarios", c.id), c.data());
    }
    await deleteDoc(d.ref);
  }

  for (const f of frentesAntigas) {
    if (f.donoId === uid) {
      if ((await getDocs(itensRef(f.id))).empty) await deleteDoc(doc(db, "frentes", f.id));
    } else {
      const membros = { ...f.membros };
      delete membros[uid];
      await updateDoc(doc(db, "frentes", f.id), { membros, membrosUids: (f.membrosUids || []).filter((m) => m !== uid) }).catch(() => {});
    }
  }
}

// Todos os itens de um contrato (do contrato e dos aditivos dele).
export function watchItensDoContrato(contratoId, callback) {
  return onSnapshot(itensRef(baseDoContrato(contratoId)), (snap) => {
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
  await deleteDoc(doc(db, ...caminhoDoItem(frenteId, itemId)));
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
  return onSnapshot(doc(db, ...caminhoDoItem(frenteId, itemId)), (snap) => {
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
    // Itens de contrato: de qual contrato (e aditivo) são — ver lib/itens.js.
    contratoId: contratoDaBase(frenteId),
    aditivoId: dados.aditivoId || null,
    criadoPor: uid,
    frenteId,
    membrosUids,
    ordem: Date.now(),
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
}

// Muda o item de lugar (frente ↔ contrato/aditivo): copia o item (mesmo id)
// e os comentários para o destino e apaga o original. Quem vê passa a ser
// quem tem acesso ao destino (membrosUids).
export async function moverItem(origem, itemId, destino, { aditivoId = null, membrosUids }) {
  const antigoRef = doc(db, ...caminhoDoItem(origem, itemId));
  const snap = await getDoc(antigoRef);
  if (!snap.exists()) throw new Error("Item não encontrado");
  const novoRef = doc(db, ...caminhoDoItem(destino, itemId));
  const contratoId = contratoDaBase(destino);
  await setDoc(novoRef, {
    ...snap.data(),
    frenteId: destino,
    contratoId,
    aditivoId: contratoId ? aditivoId || null : null,
    contratoVinculado: null,
    membrosUids,
    atualizadoEm: serverTimestamp(),
  });
  const comentarios = await getDocs(collection(antigoRef, "comentarios"));
  for (const c of comentarios.docs) {
    const destinoComentario = doc(novoRef, "comentarios", c.id);
    await setDoc(destinoComentario, c.data()).catch(async (erro) => {
      // Já existe (o item esteve aqui antes e o comentário, de outra pessoa,
      // ficou para trás): é o mesmo comentário, então segue.
      const existente = await getDoc(destinoComentario).catch(() => null);
      if (!existente?.exists()) throw erro;
    });
  }
  await deleteDoc(antigoRef);
  // Os comentários antigos que a pessoa pode apagar (os dela) saem também.
  await Promise.all(comentarios.docs.map((c) => deleteDoc(c.ref).catch(() => {})));
}

export async function atualizarItem(frenteId, itemId, dados) {
  return updateDoc(doc(db, ...caminhoDoItem(frenteId, itemId)), {
    ...dados,
    atualizadoEm: serverTimestamp(),
  });
}

export async function marcarConcluido(frenteId, itemId, concluido) {
  return updateDoc(doc(db, ...caminhoDoItem(frenteId, itemId)), {
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
