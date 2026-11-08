import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

// CCs/ODIs, recursos (com as alocações por mês) e medições salvas de um
// contrato. A lógica (ler planilha, dividir, somar) fica em lib/alocacoes.js.

const ref = (contratoId, sub) => collection(db, "contratos", contratoId, sub);

function ouvir(q, callback, onError) {
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (e) => {
      console.error(e);
      onError?.(e);
    }
  );
}

// ---------- CCs e ODIs ----------

export function watchCentros(contratoId, callback, onError) {
  return ouvir(query(ref(contratoId, "centros"), orderBy("codigo")), callback, onError);
}

export async function salvarCentro(contratoId, id, dados) {
  const valores = {
    tipo: dados.tipo === "ODI" ? "ODI" : "CC",
    codigo: dados.codigo.trim(),
    descricao: (dados.descricao || "").trim(),
    responsavel: (dados.responsavel || "").trim(),
    orcamentoMensal: dados.orcamentoMensal ?? null,
    orcamentoAnual: dados.orcamentoAnual ?? null,
    atualizadoEm: serverTimestamp(),
  };
  if (id) return updateDoc(doc(db, "contratos", contratoId, "centros", id), valores);
  return addDoc(ref(contratoId, "centros"), { ...valores, criadoEm: serverTimestamp() });
}

export function excluirCentro(contratoId, id) {
  return deleteDoc(doc(db, "contratos", contratoId, "centros", id));
}

// ---------- Equipes (cada uma com as suas frentes) ----------

export function watchEquipes(contratoId, callback, onError) {
  return ouvir(query(ref(contratoId, "equipes"), orderBy("nome")), callback, onError);
}

export async function salvarEquipe(contratoId, id, dados) {
  const valores = {
    nome: dados.nome.trim(),
    responsavel: (dados.responsavel || "").trim(),
    frentes: (dados.frentes || []).map((f) => ({ id: f.id, nome: f.nome.trim() })).filter((f) => f.nome),
    atualizadoEm: serverTimestamp(),
  };
  if (id) return updateDoc(doc(db, "contratos", contratoId, "equipes", id), valores);
  return addDoc(ref(contratoId, "equipes"), { ...valores, criadoEm: serverTimestamp() });
}

export function excluirEquipe(contratoId, id) {
  return deleteDoc(doc(db, "contratos", contratoId, "equipes", id));
}

// ---------- Recursos ----------

export function watchRecursos(contratoId, callback, onError) {
  return ouvir(query(ref(contratoId, "recursos"), orderBy("nome")), callback, onError);
}

export async function salvarRecurso(contratoId, id, dados) {
  const valores = {
    nome: dados.nome.trim(),
    perfil: (dados.perfil || "").trim(),
    valorHH: dados.valorHH ?? null,
    alocacoes: dados.alocacoes || [],
    atualizadoEm: serverTimestamp(),
  };
  if (id) return updateDoc(doc(db, "contratos", contratoId, "recursos", id), valores);
  return addDoc(ref(contratoId, "recursos"), { ...valores, criadoEm: serverTimestamp() });
}

export function excluirRecurso(contratoId, id) {
  return deleteDoc(doc(db, "contratos", contratoId, "recursos", id));
}

// ---------- Medições ----------

export function watchMedicoes(contratoId, callback, onError) {
  return ouvir(query(ref(contratoId, "medicoes"), orderBy("mes", "desc")), callback, onError);
}

export function watchMedicao(contratoId, mes, callback) {
  return onSnapshot(
    doc(db, "contratos", contratoId, "medicoes", mes),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (e) => {
      console.error(e);
      callback(null);
    }
  );
}

// Salva a medição do mês (uma por mês; subir de novo substitui) e cria os
// recursos novos marcados em "Salvar como alocação". Se o contrato tem
// lembrete de medição, marca o ciclo (o mês do prazo) como "subida": o
// lembrete só sai do "O que fazer" quando a medição for marcada como lançada.
export async function salvarMedicao(contratoId, { mes, arquivoNome, linhas, total, horas, user, novosRecursos = [], alocacoesExistentes = [], ciclo }) {
  const batch = writeBatch(db);
  batch.set(doc(db, "contratos", contratoId, "medicoes", mes), {
    mes,
    arquivoNome: arquivoNome || "",
    linhas,
    total,
    horas,
    status: "a_lancar",
    subidaPor: user.uid,
    subidaPorNome: user.displayName || user.email || "",
    criadoEm: serverTimestamp(),
    atualizadoEm: serverTimestamp(),
  });
  for (const r of novosRecursos) {
    batch.set(doc(ref(contratoId, "recursos")), {
      nome: r.nome.trim(),
      perfil: r.perfil || "",
      valorHH: r.valorHH ?? null,
      alocacoes: r.alocacoes,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
  }
  for (const r of alocacoesExistentes) {
    batch.update(doc(db, "contratos", contratoId, "recursos", r.id), { alocacoes: r.alocacoes, atualizadoEm: serverTimestamp() });
  }
  if (ciclo) {
    batch.update(doc(db, "contratos", contratoId), { [`medicao.subidas.${ciclo}`]: true, atualizadoEm: serverTimestamp() });
  }
  await batch.commit();
}

export function atualizarMedicao(contratoId, mes, dados) {
  return updateDoc(doc(db, "contratos", contratoId, "medicoes", mes), { ...dados, atualizadoEm: serverTimestamp() });
}

// Lançada no sistema: é aqui que o lembrete do ciclo sai do "O que fazer".
export async function marcarLancada(contratoId, mes, lancada, ciclo) {
  const batch = writeBatch(db);
  batch.update(doc(db, "contratos", contratoId, "medicoes", mes), {
    status: lancada ? "lancada" : "a_lancar",
    lancadaEm: lancada ? serverTimestamp() : deleteField(),
    atualizadoEm: serverTimestamp(),
  });
  if (ciclo) batch.update(doc(db, "contratos", contratoId), { [`medicao.feitas.${ciclo}`]: lancada ? true : deleteField(), atualizadoEm: serverTimestamp() });
  await batch.commit();
}

export async function excluirMedicao(contratoId, mes, ciclo) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "contratos", contratoId, "medicoes", mes));
  if (ciclo) batch.update(doc(db, "contratos", contratoId), { [`medicao.subidas.${ciclo}`]: deleteField(), [`medicao.feitas.${ciclo}`]: deleteField(), atualizadoEm: serverTimestamp() });
  await batch.commit();
}
