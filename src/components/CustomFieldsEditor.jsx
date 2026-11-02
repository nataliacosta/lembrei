export default function CustomFieldsEditor({ campos, onChange }) {
  function atualizarCampo(index, chave, valor) {
    const novos = campos.map((c, i) => (i === index ? { ...c, [chave]: valor } : c));
    onChange(novos);
  }

  function remover(index) {
    onChange(campos.filter((_, i) => i !== index));
  }

  function adicionar() {
    onChange([...campos, { label: "", valor: "" }]);
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {campos.map((campo, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="Nome do campo"
              value={campo.label}
              onChange={(e) => atualizarCampo(i, "label", e.target.value)}
              style={{ flex: "1 1 180px" }}
            />
            <input
              type="text"
              placeholder="Valor"
              value={campo.valor}
              onChange={(e) => atualizarCampo(i, "valor", e.target.value)}
              style={{ flex: "2 1 260px" }}
            />
            <button type="button" onClick={() => remover(i)} className="btn-ghost btn" style={{ padding: "6px 10px" }}>
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={adicionar}
        style={{
          marginTop: 10,
          background: "none",
          border: "1px dashed var(--color-gray-light)",
          borderRadius: 8,
          padding: "8px 14px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-primary)",
        }}
      >
        + Adicionar campo
      </button>
    </div>
  );
}
