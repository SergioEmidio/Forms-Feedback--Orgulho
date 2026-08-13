// utils/validacao.js
// Regras de validação de cada campo do formulário de avaliação.
// Cada função retorna: { valido: boolean, mensagem: string }
// "mensagem" só é usada quando valido === false (é o texto exibido abaixo do campo).

import { IDADE_MINIMA, LIMITE_CARACTERES_OPINIAO } from '../config.js';

// ---------- NOME COMPLETO ----------
export function validarNome(valor) {
  const nome = (valor || '').trim();

  if (!nome) {
    return { valido: false, mensagem: 'O nome completo é obrigatório.' };
  }

  // Só letras (com acentos), espaços e apóstrofo/hífen (ex: "D'Ávila", "Ana-Beatriz")
  const regexLetras = /^[A-Za-zÀ-ÖØ-öø-ÿ'’\- ]+$/;
  if (!regexLetras.test(nome)) {
    return { valido: false, mensagem: 'O nome deve conter apenas letras e espaços.' };
  }

  // Precisa ter nome + sobrenome (pelo menos duas palavras)
  const palavras = nome.split(/\s+/).filter(Boolean);
  if (palavras.length < 2) {
    return { valido: false, mensagem: 'Digite o nome completo (nome e sobrenome).' };
  }

  // Cada palavra precisa ter pelo menos 2 letras (evita "A B" ou iniciais soltas)
  const palavraCurtaDemais = palavras.some((p) => p.length < 2);
  if (palavraCurtaDemais) {
    return { valido: false, mensagem: 'Cada parte do nome deve ter pelo menos 2 letras.' };
  }

  return { valido: true, mensagem: '' };
}

// ---------- DATA DE NASCIMENTO ----------
export function validarNascimento(valor) {
  if (!valor) {
    return { valido: false, mensagem: 'A data de nascimento é obrigatória.' };
  }

  const dataNascimento = new Date(valor + 'T00:00:00');
  if (isNaN(dataNascimento.getTime())) {
    return { valido: false, mensagem: 'Data inválida.' };
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (dataNascimento > hoje) {
    return { valido: false, mensagem: 'A data de nascimento não pode ser no futuro.' };
  }

  // Calcula idade exata (considera se já fez aniversário este ano)
  let idade = hoje.getFullYear() - dataNascimento.getFullYear();
  const aindaNaoFezAniversario =
    hoje.getMonth() < dataNascimento.getMonth() ||
    (hoje.getMonth() === dataNascimento.getMonth() && hoje.getDate() < dataNascimento.getDate());
  if (aindaNaoFezAniversario) idade--;

  if (idade < IDADE_MINIMA) {
    return { valido: false, mensagem: `É necessário ter pelo menos ${IDADE_MINIMA} anos para responder.` };
  }

  if (idade > 120) {
    return { valido: false, mensagem: 'Verifique a data informada.' };
  }

  return { valido: true, mensagem: '' };
}

// ---------- TIPO DE PARTICIPANTE ----------
// "detalheOutro" só é obrigatório quando valor === 'Outro'; nos demais casos é ignorado.
export function validarTipoParticipante(valor, detalheOutro) {
  const opcoesValidas = ['Aluno', 'Ex-aluno', 'Responsável', 'Outro'];

  if (!valor || !opcoesValidas.includes(valor)) {
    return { valido: false, mensagem: 'Selecione uma opção.' };
  }

  if (valor === 'Outro') {
    const detalhe = (detalheOutro || '').trim();

    if (!detalhe) {
      return { valido: false, mensagem: 'Descreva o que você é no campo que apareceu abaixo.' };
    }

    if (detalhe.length < 2) {
      return { valido: false, mensagem: 'Escreva pelo menos 2 caracteres.' };
    }
  }

  return { valido: true, mensagem: '' };
}

// ---------- NOTA ----------
export function validarNota(valor) {
  const nota = Number(valor);

  if (!valor || isNaN(nota)) {
    return { valido: false, mensagem: 'Escolha uma nota de 1 a 10.' };
  }

  if (nota < 1 || nota > 10 || !Number.isInteger(nota)) {
    return { valido: false, mensagem: 'A nota deve ser um número entre 1 e 10.' };
  }

  return { valido: true, mensagem: '' };
}

// ---------- CONSENTIMENTO ----------
export function validarConsentimento(valor) {
  if (valor !== 'sim') {
    return { valido: false, mensagem: 'É necessário concordar para enviar o formulário.' };
  }

  return { valido: true, mensagem: '' };
}

// ---------- OPINIÃO (OPCIONAL) ----------
export function validarOpiniao(valor) {
  const texto = valor || '';

  if (texto.length > LIMITE_CARACTERES_OPINIAO) {
    return {
      valido: false,
      mensagem: `Máximo de ${LIMITE_CARACTERES_OPINIAO} caracteres (${texto.length}/${LIMITE_CARACTERES_OPINIAO}).`,
    };
  }

  return { valido: true, mensagem: '' };
}

// ---------- VALIDAÇÃO COMPLETA DO FORMULÁRIO ----------
// Recebe o objeto de respostas (ex: vindo de Object.fromEntries(new FormData(form)))
// e retorna um relatório campo a campo + um "valido" geral.
export function validarFormulario(respostas) {
  const resultado = {
    'nome-completo': validarNome(respostas['nome-completo']),
    nascimento: validarNascimento(respostas['nascimento']),
    'tipo-participante': validarTipoParticipante(respostas['tipo-participante'], respostas['outro-detalhe']),
    nota: validarNota(respostas['nota']),
    consentimento: validarConsentimento(respostas['consentimento']),
    opiniao: validarOpiniao(respostas['opiniao']),
  };

  const valido = Object.values(resultado).every((campo) => campo.valido);

  return { valido, campos: resultado };
}

export const LIMITES = {
  IDADE_MINIMA,
  LIMITE_CARACTERES_OPINIAO,
};