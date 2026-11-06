// Roda dentro de "firebase emulators:exec": grava notificações no Firestore
// emulado e confere se a function mandou o push para o "serviço de push" falso.
import http from "node:http";
import crypto from "node:crypto";
import functionsTest from "firebase-functions-test";
const ft = functionsTest({ projectId: "demo-lembrei" });
const webpush = (await import("web-push")).default;
// Registra os envios em vez de mandar pela rede (endereços de teste são http).
webpush.sendNotification = async (sub, payload, opts) => {
  const det = webpush.generateRequestDetails(sub, payload, opts); // cifra e assina de verdade
  recebidos.push({ url: new URL(sub.endpoint).pathname, corpo: det.body.length, cifrado: det.headers["Content-Encoding"], vapid: String(det.headers.Authorization || "").startsWith("vapid t="), aviso: JSON.parse(payload) });
  if (sub.endpoint.includes("vencido")) { const e = new Error("Gone"); e.statusCode = 410; throw e; }
  return { statusCode: 201 };
};
const { avisarNotificacao } = await import("../lib/index.js");
const { getFirestore } = await import("firebase-admin/firestore");
const recebidos = [];
const servidor = http.createServer((req, res) => {
  let corpo = 0;
  req.on("data", (c) => (corpo += c.length));
  req.on("end", () => {
    recebidos.push({ url: req.url, corpo, ttl: req.headers.ttl, cifrado: req.headers["content-encoding"] });
    res.statusCode = req.url.includes("vencido") ? 410 : 201;
    res.end();
  });
});
await new Promise((r) => servidor.listen(9911, r));
const chaves = () => {
  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey().toString("base64url"), auth: crypto.randomBytes(16).toString("base64url") };
};
const db = getFirestore();
const ana = db.collection("usuarios").doc("ana");
await ana.set({ nome: "Ana" });
await ana.collection("dispositivos").doc("ok").set({ endpoint: "http://127.0.0.1:9911/push/ok", keys: chaves(), nome: "Chrome" });
await ana.collection("dispositivos").doc("velho").set({ endpoint: "http://127.0.0.1:9911/push/vencido", keys: chaves(), nome: "iPhone antigo" });
const disparar = async (dados) => {
  const ref = await db.collection("notificacoes").add(dados);
  const snap = await ref.get();
  await ft.wrap(avisarNotificacao)({ data: snap, params: { id: ref.id } });
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
let falhas = 0;
const conferir = (nome, cond, extra = "") => { if (!cond) falhas++; console.log(cond ? "  ✔" : "  ✘", nome, cond ? "" : extra); };

await disparar({ destinatarioId: "ana", autorId: "bruno", autorNome: "Bruno", tipo: "mencao", alvo: "Validar cronograma", trecho: "@Ana confirma?", link: "/frentes/f/itens/i", lida: false });
for (let i = 0; i < 40 && recebidos.length < 2; i++) await esperar(500);
const ok = recebidos.find((r) => r.url === "/push/ok");
conferir("push enviado ao aparelho válido, cifrado (aes128gcm) e assinado com VAPID", ok && ok.corpo > 0 && ok.cifrado === "aes128gcm" && ok.vapid, JSON.stringify(recebidos));
conferir("texto do aviso", ok?.aviso?.title === "Bruno mencionou você em Validar cronograma" && ok?.aviso?.body === "“@Ana confirma?”" && ok?.aviso?.link === "/frentes/f/itens/i", JSON.stringify(ok?.aviso));
await esperar(1500);
conferir("aparelho com inscrição vencida (410) foi removido", !(await ana.collection("dispositivos").doc("velho").get()).exists);

const antes = recebidos.length;
await ana.set({ prefsNotificacoes: { tipos: { comentarios: false } } }, { merge: true });
await disparar({ destinatarioId: "ana", autorId: "bruno", autorNome: "Bruno", tipo: "comentario", alvo: "X", trecho: "oi", link: "/", lida: false });
await esperar(5000);
conferir("com 'Comentários' desligado, não manda push", recebidos.length === antes, `${recebidos.length - antes} envio(s)`);

await disparar({ destinatarioId: "ana", autorId: "bruno", autorNome: "Bruno", tipo: "atribuido", alvo: "Y", link: "/", lida: false });
for (let i = 0; i < 30 && recebidos.length === antes; i++) await esperar(500);
conferir("outro tipo (atribuído) continua chegando (só no aparelho que sobrou)", recebidos.length === antes + 1, String(recebidos.length - antes));

console.log(falhas ? `${falhas} falha(s)` : "tudo ok");
servidor.close(); process.exit(falhas ? 1 : 0);
