// services/respostasServices.js
// Única camada do projeto que sabe "para onde" os dados de respostas vão.
// O "como fazer a requisição" fica no api.js — aqui só decidimos qual URL
// e qual formato de dado é específico das respostas do formulário.

import { apiGet, apiPost } from './api.js';
import { API_URL } from '../config.js';

/**
 * Envia as respostas do formulário de avaliação para o backend.
 * @param {Object} respostas - objeto com os dados do formulário
 *   ex: { 'nome-completo': 'Ana Silva', nascimento: '2005-03-10', 'tipo-participante': 'Aluno', nota: '9', opiniao: '...' }
 * @returns {Promise<Object>} os dados retornados pelo backend (ex: { id, criadoEm })
 * @throws {Error} se a requisição falhar (rede ou resposta com status de erro)
 */
export async function enviarResposta(respostas) {
  return apiPost(API_URL, respostas);
}

/**
 * Busca todas as respostas já enviadas (uso futuro: dashboard.js vai chamar isso
 * pra listar/gráficar as avaliações recebidas).
 * @returns {Promise<Array<Object>>}
 */
export async function buscarRespostas() {
  return apiGet(API_URL);
}