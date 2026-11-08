import { arrayRemove, arrayUnion, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db } from "../firebase";
import { VAPID_PUBLICO } from "./pushChave";

// Web Push: cada aparelho em que a pessoa ativou as notificações fica em
// usuarios/{uid}/dispositivos/{id}; as Cloud Functions mandam os avisos.

export function suportaPush() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function ehIOS() {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

// Aberto pelo ícone da Tela de Início (necessário para push no iPhone).
export function estaInstalado() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function nomeDoAparelho() {
  const ua = navigator.userAgent || "";
  const navegador = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  if (ehIOS()) return /iPad/.test(ua) || ua.includes("Macintosh") ? "iPad (Tela de Início)" : "iPhone (Tela de Início)";
  if (/Android/.test(ua)) return `Android · ${navegador}`;
  return `${navegador} no computador`;
}

function base64UrlParaBytes(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const bruto = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...bruto].map((c) => c.charCodeAt(0)));
}

async function idDoEndpoint(endpoint) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(hash)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function registrarServiceWorker() {
  if (!suportaPush()) return null;
  return navigator.serviceWorker.register("/sw.js");
}

// A inscrição deste aparelho (se já estiver ativado), com o id do documento.
export async function inscricaoAtual() {
  if (!suportaPush()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return null;
  return { sub, id: await idDoEndpoint(sub.endpoint) };
}

export async function ativarPush(uid) {
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") throw new Error(permissao === "denied" ? "bloqueado" : "sem-permissao");
  const reg = (await navigator.serviceWorker.getRegistration()) || (await registrarServiceWorker());
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlParaBytes(VAPID_PUBLICO) }));
  const json = sub.toJSON();
  const id = await idDoEndpoint(sub.endpoint);
  await setDoc(doc(db, "usuarios", uid, "dispositivos", id), {
    endpoint: json.endpoint,
    keys: json.keys,
    nome: nomeDoAparelho(),
    criadoEm: serverTimestamp(),
  });
  return id;
}

export async function desativarPush(uid) {
  const atual = await inscricaoAtual();
  if (!atual) return;
  await deleteDoc(doc(db, "usuarios", uid, "dispositivos", atual.id)).catch(() => {});
  await atual.sub.unsubscribe();
}

export async function removerDispositivo(uid, id) {
  await deleteDoc(doc(db, "usuarios", uid, "dispositivos", id));
}

export function watchDispositivos(uid, callback) {
  return onSnapshot(collection(db, "usuarios", uid, "dispositivos"), (snap) =>
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

export function watchPrefs(uid, callback) {
  return onSnapshot(doc(db, "usuarios", uid), (snap) => callback(snap.data()?.prefsNotificacoes || null));
}

export async function salvarPrefs(uid, prefs) {
  await setDoc(doc(db, "usuarios", uid), { prefsNotificacoes: prefs }, { merge: true });
}

export async function enviarTeste() {
  const funcao = httpsCallable(getFunctions(app, "southamerica-east1"), "enviarPushTeste");
  const { data } = await funcao();
  return data?.enviados || 0;
}

// Funcionalidades ligadas/desligadas (ver lib/funcionalidades.js).
export async function salvarFuncionalidades(uid, funcionalidades) {
  await setDoc(doc(db, "usuarios", uid), { funcionalidades }, { merge: true });
}

// Contratos em que a pessoa só faz as medições (vale só para ela).
export function watchContratosSoMedicao(uid, callback) {
  return onSnapshot(
    doc(db, "usuarios", uid),
    (snap) => callback(snap.data()?.contratosSoMedicao || []),
    (e) => console.error("Erro ao ler os contratos só de medição:", e)
  );
}

export async function definirSoMedicao(uid, contratoId, soMedicao) {
  await setDoc(doc(db, "usuarios", uid), { contratosSoMedicao: soMedicao ? arrayUnion(contratoId) : arrayRemove(contratoId) }, { merge: true });
}

export function watchFuncionalidades(uid, callback) {
  return onSnapshot(
    doc(db, "usuarios", uid),
    (snap) => callback(snap.data()?.funcionalidades || null),
    (e) => console.error("Erro ao ler as funcionalidades:", e)
  );
}
