import { useState } from "react";
import { CLIENT_NAME } from "../theme";
import { setKey } from "../lib/api";

export function Login({ onOk, error }: { onOk: () => void; error?: boolean }) {
  const [value, setValue] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setKey(value.trim());
    onOk();
  };
  return (
    <div className="login-wrap">
      <form className="login card" onSubmit={submit}>
        <div className="brand-badge">{CLIENT_NAME.slice(0, 1)}</div>
        <h2>Dashboard {CLIENT_NAME}</h2>
        <p>Digite a chave de acesso para continuar.</p>
        <input
          className="field"
          type="password"
          placeholder="Chave de acesso"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="btn primary" type="submit">Entrar</button>
        {error && <div className="err-msg">Chave inválida. Tente novamente.</div>}
      </form>
    </div>
  );
}
