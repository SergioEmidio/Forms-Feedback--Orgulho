// Mostrar mensagens de sucesso/erro na tela (reutilizável) //

// components/mensagem.js
// Componente reutilizável de feedback por campo.
// Espera que cada campo do HTML siga o padrão de IDs:
//   status-{nomeCampo}  -> onde aparece "✓ Correto" ou "✗ Incorreto"
//   erro-{nomeCampo}    -> onde aparece o motivo do erro (texto)
// "nomeCampo" é o mesmo valor usado no atributo name/id do input (ex: "nome-completo").

/**
 * Atualiza o status visual de um campo com base no resultado da validação.
 * @param {string} nomeCampo - ex: "nome-completo", "nascimento", "tipo-participante", "nota", "opiniao"
 * @param {{ valido: boolean, mensagem: string }} resultado - retorno das funções de utils/validacao.js
 */
export function atualizarStatusCampo(nomeCampo, resultado) {
  const statusEl = document.getElementById(`status-${nomeCampo}`);
  const erroEl = document.getElementById(`erro-${nomeCampo}`);

  // Campo opcional que ainda está vazio (ex: opinião não preenchida): não mostra nem ✓ nem ✗
  if (statusEl && resultado.semStatus) {
    statusEl.textContent = '';
    statusEl.className = 'status-validacao';
  } else if (statusEl) {
    statusEl.textContent = resultado.valido ? '✓ Correto' : '✗ Incorreto';
    statusEl.className = resultado.valido
      ? 'status-validacao status-validacao--ok'
      : 'status-validacao status-validacao--erro';
  }

  if (erroEl) {
    erroEl.textContent = resultado.valido ? '' : resultado.mensagem;
  }
}

/** Limpa o status visual de um único campo (usado no reset do formulário). */
export function limparStatusCampo(nomeCampo) {
  const statusEl = document.getElementById(`status-${nomeCampo}`);
  const erroEl = document.getElementById(`erro-${nomeCampo}`);

  if (statusEl) {
    statusEl.textContent = '';
    statusEl.className = 'status-validacao';
  }
  if (erroEl) {
    erroEl.textContent = '';
  }
}

/** Limpa o status visual de vários campos de uma vez (ex: ao resetar o formulário inteiro). */
export function limparTodosOsStatus(nomesCampos) {
  nomesCampos.forEach(limparStatusCampo);
}