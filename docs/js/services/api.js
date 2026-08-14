// services/api.js
// Camada mais genérica do projeto: só sabe "como" fazer uma requisição HTTP
// (montar headers, tratar erro de rede, converter JSON, lançar erro legível).
// NÃO sabe nada sobre "respostas de formulário" — isso é responsabilidade
// de quem chama (ex: respostasServices.js). Assim, qualquer outro arquivo
// de serviço (ex: resumoService.js) pode reaproveitar essas mesmas funções.

/**
 * Faz uma requisição GET e devolve o corpo já convertido de JSON.
 * @param {string} url - endpoint completo (ex: API_URL do config.js)
 * @returns {Promise<any>}
 * @throws {Error} com mensagem legível em caso de falha de rede ou resposta de erro
 */
export async function apiGet(url) {
  const response = await requisitar(url, { method: 'GET' });
  return lerCorpoJson(response);
}

/**
 * Faz uma requisição POST enviando "dados" como JSON e devolve o corpo da resposta.
 * @param {string} url - endpoint completo
 * @param {Object} dados - objeto que será convertido em JSON e enviado no corpo
 * @returns {Promise<any>}
 * @throws {Error} com mensagem legível em caso de falha de rede ou resposta de erro
 */
export async function apiPost(url, dados) {
  const response = await requisitar(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(dados),
  });
  return lerCorpoJson(response);
}

// ---------- INTERNO: NÃO EXPORTADO, USADO SÓ AQUI DENTRO ----------

/** Executa o fetch e já intercepta erro de rede/CORS com mensagem amigável. */
async function requisitar(url, opcoes) {
  let response;

  try {
    response = await fetch(url, opcoes);
  } catch (erroDeRede) {
    throw new Error('Não foi possível conectar ao servidor. Verifique sua internet.');
  }

  if (!response.ok) {
    const mensagem = await montarMensagemDeErro(response);
    const erro = new Error(mensagem);
    erro.status = response.status;
    throw erro;
  }

  return response;
}

/** Tenta extrair uma mensagem de erro útil do corpo da resposta; senão, usa uma genérica. */
async function montarMensagemDeErro(response) {
  try {
    const corpo = await response.json();
    if (corpo && (corpo.mensagem || corpo.message || corpo.detail)) {
      return corpo.mensagem || corpo.message || corpo.detail;
    }
  } catch {
    // resposta de erro sem corpo JSON válido — cai na mensagem genérica abaixo
  }

  return `Erro na requisição (código ${response.status}).`;
}

/** Lê o corpo como JSON; se a resposta não tiver corpo (ex: 204), devolve objeto vazio. */
async function lerCorpoJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}