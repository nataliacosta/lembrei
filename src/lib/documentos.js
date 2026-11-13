// Documentos de contratos e aditivos (minuta, anexos, racionais, fichas...).
// O arquivo fica no Storage em contratos/{contrato}/documentos/{doc}/{nome} e
// os dados (nome, tamanho, quem enviou) em contratos/{contrato}/documentos.
// aditivoId: null = documento do contrato; senão, do aditivo.
import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { deleteObject, getBlob, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "../firebase";

export const LIMITE_BYTES = 25 * 1024 * 1024;

function documentosRef(contratoId) {
  return collection(db, "contratos", contratoId, "documentos");
}

// Todos os documentos do contrato (do contrato e dos aditivos), mais novos por último.
export function watchDocumentos(contratoId, callback) {
  const q = query(documentosRef(contratoId), orderBy("enviadoEm", "asc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), () => callback([]));
}

// Nome seguro para o caminho no Storage (o nome original fica no documento).
function nomeNoCaminho(nome) {
  const limpo = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._ -]+/g, "_").trim();
  return (limpo || "arquivo").slice(-120);
}

// Envia um arquivo. onProgresso(0..1).
export async function enviarDocumento(contratoId, { arquivo, aditivoId = null, user, onProgresso }) {
  if (arquivo.size > LIMITE_BYTES) throw new Error(`${arquivo.name} tem mais de 25 MB.`);
  const novoRef = doc(documentosRef(contratoId));
  const caminho = `contratos/${contratoId}/documentos/${novoRef.id}/${nomeNoCaminho(arquivo.name)}`;
  const arqRef = ref(storage, caminho);
  const tarefa = uploadBytesResumable(arqRef, arquivo, {
    contentType: arquivo.type || "application/octet-stream",
    contentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(arquivo.name)}`,
  });
  await new Promise((ok, erro) => {
    tarefa.on("state_changed", (s) => onProgresso?.(s.totalBytes ? s.bytesTransferred / s.totalBytes : 0), erro, ok);
  });
  try {
    await setDoc(novoRef, {
      nome: arquivo.name.slice(0, 200),
      tamanho: arquivo.size,
      tipo: (arquivo.type || "").slice(0, 120),
      caminho,
      aditivoId: aditivoId || null,
      enviadoPor: user.uid,
      enviadoPorNome: (user.displayName || user.email || "").slice(0, 120),
      enviadoEm: serverTimestamp(),
    });
  } catch (e) {
    await deleteObject(arqRef).catch(() => {});
    throw e;
  }
}

export async function excluirDocumento(contratoId, documento) {
  await deleteObject(ref(storage, documento.caminho)).catch((e) => {
    if (e?.code !== "storage/object-not-found") throw e;
  });
  await deleteDoc(doc(db, "contratos", contratoId, "documentos", documento.id));
}

// Apaga todos os arquivos do contrato (usado ao excluir o contrato).
export async function excluirArquivosDoContrato(contratoId) {
  const snap = await getDocs(documentosRef(contratoId));
  await Promise.all(snap.docs.map((d) => deleteObject(ref(storage, d.data().caminho)).catch(() => {})));
}

function salvarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function baixarDocumento(documento) {
  const blob = await getBlob(ref(storage, documento.caminho));
  salvarBlob(blob, documento.nome);
}

// Nomes repetidos no .zip ganham " (2)", " (3)"...
export function nomesUnicos(nomes) {
  const usados = new Map();
  return nomes.map((n) => {
    const k = n.toLowerCase();
    const vezes = usados.get(k) || 0;
    usados.set(k, vezes + 1);
    if (!vezes) return n;
    const ponto = n.lastIndexOf(".");
    return ponto > 0 ? `${n.slice(0, ponto)} (${vezes + 1})${n.slice(ponto)}` : `${n} (${vezes + 1})`;
  });
}

export async function baixarTodos(documentos, nomeZip) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const nomes = nomesUnicos(documentos.map((d) => d.nome));
  const blobs = await Promise.all(documentos.map((d) => getBlob(ref(storage, d.caminho))));
  blobs.forEach((b, i) => zip.file(nomes[i], b));
  const conteudo = await zip.generateAsync({ type: "blob" });
  salvarBlob(conteudo, `${nomeZip.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120)}.zip`);
}

export function formatarTamanho(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export function extensao(nome) {
  const m = String(nome || "").match(/\.([A-Za-z0-9]{1,5})$/);
  return m ? m[1].toUpperCase() : "ARQ";
}
