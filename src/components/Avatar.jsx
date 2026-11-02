import { useState } from "react";

export function iniciais(nome) {
  if (!nome) return "?";
  return nome
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

// Foto da conta Google da pessoa; sem foto (ou se ela não carregar), as iniciais.
export default function Avatar({ nome, url, tamanho = 32, className = "", style, decorativo = false }) {
  const [falhou, setFalhou] = useState(false);
  const mostrarFoto = Boolean(url) && !falhou;
  const rotulo = nome || "Pessoa";

  return (
    <span
      className={`avatar ${className}`}
      title={nome}
      role={decorativo ? undefined : "img"}
      aria-label={decorativo ? undefined : rotulo}
      aria-hidden={decorativo ? "true" : undefined}
      style={{
        width: tamanho,
        height: tamanho,
        fontSize: Math.max(10, Math.round(tamanho * 0.36)),
        overflow: "hidden",
        ...style,
      }}
    >
      {mostrarFoto ? (
        <img
          src={url}
          alt=""
          width={tamanho}
          height={tamanho}
          referrerPolicy="no-referrer"
          onError={() => setFalhou(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        iniciais(nome)
      )}
    </span>
  );
}
