// Logo do Lembrei!: um ✓ cuja haste longa vira o traço de um "!", com o
// ponto em verde-limão. `fundo` muda a cor do quadrado (ex.: escuro sobre
// fundos verdes, como na tela de login).
export function LogoMarca({ tamanho = 32, fundo = "var(--color-brand)", decorativo = true }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={tamanho}
      height={tamanho}
      role={decorativo ? undefined : "img"}
      aria-label={decorativo ? undefined : "Lembrei!"}
      aria-hidden={decorativo ? "true" : undefined}
      style={{ flex: "0 0 auto", display: "block" }}
    >
      <rect width="64" height="64" rx="16" fill={fundo} />
      <path d="M20 29l9 9L41 12" fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="29" cy="50" r="5.5" fill="#c3ff24" />
    </svg>
  );
}

// Nome com o "!" em destaque (verde no fundo claro, verde-limão no escuro).
export function LogoNome({ tamanho = 18, escuro = false }) {
  return (
    <span style={{ fontWeight: 700, fontSize: tamanho, color: escuro ? "#fff" : "var(--color-dark)", letterSpacing: "-0.01em" }}>
      Lembrei<span style={{ color: escuro ? "var(--color-accent)" : "var(--color-brand)" }}>!</span>
    </span>
  );
}
