// services/respostasServices.js
// Única camada do projeto que sabe "para onde" os dados de respostas vão.
// O "como fazer a requisição" fica no api.js — aqui só decidimos qual URL,
// qual formato de dado, e quando o token de login precisa ir junto.

import { apiGet, apiPost, apiDelete } from './api.js';
import { RESPOSTAS_URL } from '../config.js';
import { obterToken } from './authServices.js';

/** Monta o header Authorization se existir um token de login guardado. */
function cabecalhoAutenticado() {
  const token = obterToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Envia as respostas do formulário de avaliação para o backend.
 * Não precisa de login — qualquer visitante pode enviar uma avaliação.
 * @param {Object} respostas - objeto com os dados do formulário
 * @returns {Promise<Object>} os dados retornados pelo backend (ex: { id, criadoEm })
 * @throws {Error} se a requisição falhar (rede ou resposta com status de erro)
 */
export async function enviarResposta(respostas) {
  return apiPost(RESPOSTAS_URL, respostas);
}

/**
 * Busca todas as respostas já enviadas. Usada pelo dashboard — precisa de login,
 * por isso manda o token no header. Se o backend rejeitar (401), o erro sobe
 * com erro.status = 401 pro dashboard.js decidir redirecionar pro login.
 * @returns {Promise<Array<Object>>}
 */
export async function buscarRespostas() {
  return apiGet(RESPOSTAS_URL, cabecalhoAutenticado());
}

/**
 * Exclui uma resposta específica pelo id. Também exige login.
 * @param {string|number} id
 * @returns {Promise<Object>}
 */
export async function deletarResposta(id) {
  return apiDelete(`${RESPOSTAS_URL}/${id}`, cabecalhoAutenticado());
}