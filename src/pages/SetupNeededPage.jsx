export default function SetupNeededPage() {
  return (
    <div style={{ maxWidth: 560, margin: "80px auto", padding: "0 24px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22 }}>Configuração do Firebase pendente</h1>
      <p style={{ color: "#555", lineHeight: 1.6 }}>
        O app ainda não tem as chaves do seu projeto Firebase. Copie <code>.env.example</code> para{" "}
        <code>.env</code> e preencha com os dados do seu projeto (Firebase Console → Configurações do
        projeto → Geral → "Seus apps").
      </p>
    </div>
  );
}
