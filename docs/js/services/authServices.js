// services/authServices.js
const BASE_URL = "https://SEUAPP.onrender.com"; // <-- substitua pela sua URL do Render

export async function fazerLogin(usuario, senha) {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, senha }),
  });

  // tenta extrair JSON, mas não quebrar caso a resposta não seja JSON
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.detail || 'Erro ao fazer login');
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data; // { token: "..." }
}

export function salvarToken(token) {
  if (!token) return;
  // você pode usar localStorage, sessionStorage ou cookie seguro
  localStorage.setItem("token", token);
}