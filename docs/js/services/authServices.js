// services/authServices.js
// Login, guarda/leitura do token JWT e checagem de sessão.
// Usa a MESMA BASE_URL centralizada em config.js — nada de URL fixa
// duplicada aqui (foi isso que quebrava o login: apontava pra um
// domínio placeholder que nunca existiu).

import { LOGIN_URL } from '../config.js';

const CHAVE_TOKEN = 'token';

/**
 * Faz login contra a API e devolve o corpo da resposta (ex: { token: "..." }).
 * @param {string} usuario
 * @param {string} senha
 * @returns {Promise<{ token: string }>}
 * @throws {Error} com .status = código HTTP quando a API respondeu com erro
 */
export async function fazerLogin(usuario, senha) {
  const res = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, senha }),
  });

  // tenta extrair JSON, mas não quebra caso a resposta não seja JSON
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.detail || 'Erro ao fazer login');
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data; // { token: "..." }
}

/** Salva o token de sessão. */
export function salvarToken(token) {
  if (!token) return;
  localStorage.setItem(CHAVE_TOKEN, token);
}

/** Lê o token salvo (ou null se não houver login ativo). */
export function obterToken() {
  return localStorage.getItem(CHAVE_TOKEN);
}

/** Verdadeiro se existe um token salvo (login ativo). */
export function estaLogado() {
  return Boolean(obterToken());
}

/** Remove o token salvo (logout, ou sessão expirada). */
export function limparToken() {
  localStorage.removeItem(CHAVE_TOKEN);
}