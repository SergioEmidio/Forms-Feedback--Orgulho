//Função específica: buscarResumo() (pro dashboard) //

import { apiGet } from './api.js';
// Só precisa do GET, já que resumo é somente leitura, nunca envia dado

// services/resumoService.js
// Calcula os indicadores agregados a partir da lista de respostas.
// Fica separado do dashboard.js pra poder ser testado/reaproveitado
// isoladamente (ex: se um dia quiser mostrar um resumo em outro lugar).

/**
 * @param {Array<Object>} respostas
 * @returns {{ total: number, notaMedia: number, porTipo: Object, porNota: Object }}
 */
export function calcularResumo(respostas) {
  const total = respostas.length;

  if (total === 0) {
    return { total: 0, notaMedia: 0, porTipo: {}, porNota: {} };
  }

  const somaNotas = respostas.reduce((soma, r) => soma + Number(r.nota || 0), 0);
  const notaMedia = somaNotas / total;

  const porTipo = {};
  const porNota = {};

  respostas.forEach((r) => {
    const tipo = r['tipo-participante'] || 'Não informado';
    porTipo[tipo] = (porTipo[tipo] || 0) + 1;

    const nota = String(r.nota || '0');
    porNota[nota] = (porNota[nota] || 0) + 1;
  });

  return { total, notaMedia, porTipo, porNota };
}