import { useState } from "react";

export default function TagInput({ tags, onChange }) {
  const [valor, setValor] = useState("");

  function adicionar() {
    const limpo = valor.trim().replace(/^#/, "");
    if (limpo && !tags.includes(limpo)) {
      onChange([...tags, limpo]);
    }
    setValor("");
  }

  function remover(tag) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {tags.map((tag) => (
        <span key={tag} className="tag-chip">
          #{tag}
          <span style={{ cursor: "pointer" }} onClick={() => remover(tag)}>
            ×
          </span>
        </span>
      ))}
      <input
        type="text"
        placeholder="+ adicionar tag"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            adicionar();
          }
        }}
        onBlur={adicionar}
        style={{ width: 140, padding: "6px 10px", fontSize: 12 }}
      />
    </div>
  );
}
