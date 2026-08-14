// services/authServices.js
// Login e gerenciamento do token de sessão do dashboard.
// dashboard.js vai usar obterToken()/estaLogado() pra decidir se mostra
// os dados ou redireciona de volta pro login.

import { apiPost } from './api.js';
import { LOGIN_URL } from '../config.js';

const CHAVE_TOKEN = 'dashboard_token';

/**
 * Faz login no backend. Retorna o corpo da resposta (deve conter { token }).
 * @throws {Error} com .status (código HTTP) quando o backend responder com erro
 */
export async function fazerLogin(usuario, senha) {
  return apiPost(LOGIN_URL, { usuario, senha });
}

export function salvarToken(token) {
  sessionStorage.setItem(CHAVE_TOKEN, token);
}

export function obterToken() {
  return sessionStorage.getItem(CHAVE_TOKEN);
}

export function limparToken() {
  sessionStorage.removeItem(CHAVE_TOKEN);
}

export function estaLogado() {
  return !!obterToken();
}