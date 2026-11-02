import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

// Comentários genéricos: funcionam em qualquer documento "pai" (um item de
// frente, um aditivo de contrato, etc), dado o caminho até ele.
// caminhoPai é um array de segmentos, ex: ["frentes", frenteId, "itens", itemId]
// ou ["contratos", contratoId, "aditivos", aditivoId].

function comentariosRef(caminhoPai) {
  return collection(db, ...caminhoPai, "comentarios");
}

export function watchComentarios(caminhoPai, callback) {
  const q = query(comentariosRef(caminhoPai), orderBy("criadoEm", "desc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function adicionarComentario(caminhoPai, { autorId, autorNome, texto }) {
  return addDoc(comentariosRef(caminhoPai), {
    texto,
    autorId,
    autorNome,
    criadoEm: serverTimestamp(),
  });
}

export async function editarComentario(caminhoPai, comentarioId, texto) {
  return updateDoc(doc(db, ...caminhoPai, "comentarios", comentarioId), {
    texto,
    editadoEm: serverTimestamp(),
  });
}

export async function excluirComentario(caminhoPai, comentarioId) {
  return deleteDoc(doc(db, ...caminhoPai, "comentarios", comentarioId));
}
