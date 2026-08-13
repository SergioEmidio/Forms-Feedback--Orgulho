// pages/form.js
// Lógica exclusiva da página do formulário (junta tudo pra rodar)

import { enviarResposta } from '../services/respostasServices.js';
import { atualizarStatusCampo, limparStatusCampo } from '../components/mensagem.js';
import {
  validarNome,
  validarNascimento,
  validarTipoParticipante,
  validarNota,
  validarConsentimento,
  validarOpiniao,
  validarFormulario,
} from '../utils/validacao.js';
import { abrirPopup, popupSucesso, popupErro } from '../components/popup.js';
import { LIMITE_CARACTERES_OPINIAO } from '../config.js';

const formulario = document.getElementById('formulario-avaliacao');
const botaoEnviar = formulario.querySelector('.cb-08__btn');
const fillBotaoEnviar = botaoEnviar.querySelector('.cb-08__fill');
const campoOpiniao = document.getElementById('opiniao');
const contadorOpiniao = document.getElementById('contador-opiniao');

// ---------- ESTRELAS DA NOTA ----------
const containerEstrelas = document.getElementById('avaliacao-estrelas');
const estrelas = Array.from(document.querySelectorAll('#avaliacao-estrelas .estrela'));
const notaTexto = document.getElementById('nota-texto');

// ---------- CAMPO "OUTRO" (revela input extra) ----------
const radioOutro = document.getElementById('tipo-outro');
const divOutroDetalhe = document.getElementById('div-outro-detalhe');
const inputOutroDetalhe = document.getElementById('outro-detalhe');

// Campos que contam pro progresso do botão (agora 5 obrigatórias, com o consentimento)
const CAMPOS_PROGRESSO = ['nome-completo', 'nascimento', 'tipo-participante', 'nota', 'consentimento'];

// Wrapper: valida "Você é" já considerando o campo de detalhe do "Outro",
// que fica fora do fluxo normal de FormData quando escondido.
function validarTipoComDetalhe(valor) {
  return validarTipoParticipante(valor, inputOutroDetalhe.value);
}

// Mapeia o nome do campo (usado nos IDs status-*/erro-*) pro elemento que deve
// receber o foco e a classe visual (campo-valido/campo-invalido) quando validado.
const CAMPOS = {
  'nome-completo': {
    elemento: document.getElementById('nome-completo'),
    validar: validarNome,
  },
  nascimento: {
    elemento: document.getElementById('nascimento'),
    validar: validarNascimento,
  },
  'tipo-participante': {
    // não tem classe campo-valido/invalido (é um grupo de radios, não um input único)
    elemento: document.getElementById('tipo-aluno'),
    validar: validarTipoComDetalhe,
    semClasseEstado: true,
  },
  nota: {
    elemento: document.getElementById('nota-1'),
    validar: validarNota,
    semClasseEstado: true,
  },
  consentimento: {
    elemento: document.getElementById('consentimento'),
    validar: validarConsentimento,
    semClasseEstado: true,
  },
  opiniao: {
    elemento: campoOpiniao,
    validar: validarOpiniao,
  },
};

// ---------- LEITURA DOS DADOS ATUAIS DO FORMULÁRIO ----------
function lerRespostas() {
  const dados = new FormData(formulario);
  return Object.fromEntries(dados.entries());
}

// ---------- VALIDA UM CAMPO E ATUALIZA A TELA (status + erro + borda) ----------
function validarCampo(nomeCampo, valorAtual, { silencioso = false } = {}) {
  const config = CAMPOS[nomeCampo];
  const resultado = config.validar(valorAtual);

  // Campo opcional (opinião) vazio: não mostra ✓ nem ✗, só limpa qualquer estado anterior
  const opcionalVazio = nomeCampo === 'opiniao' && !valorAtual;
  const resultadoExibido = opcionalVazio ? { ...resultado, semStatus: true } : resultado;

  if (!silencioso) {
    atualizarStatusCampo(nomeCampo, resultadoExibido);
  }

  if (config.elemento && !config.semClasseEstado) {
    config.elemento.classList.remove('campo-valido', 'campo-invalido');
    if (!opcionalVazio) {
      config.elemento.classList.add(resultado.valido ? 'campo-valido' : 'campo-invalido');
    }
  }

  return resultado;
}

// ---------- ESTRELAS: preenche da esquerda até a nota escolhida ----------
function atualizarEstrelas(valor) {
  const notaSelecionada = Number(valor) || 0;

  estrelas.forEach((estrela, index) => {
    // index 0 = nota 1 (primeira estrela da esquerda), index 9 = nota 10
    estrela.classList.toggle('preenchida', index < notaSelecionada);
  });

  if (notaSelecionada > 0) {
    notaTexto.textContent = `Nota selecionada: ${notaSelecionada}/10`;
    notaTexto.classList.add('nota-texto--preenchida');
  } else {
    notaTexto.textContent = 'Toque em uma estrela para avaliar';
    notaTexto.classList.remove('nota-texto--preenchida');
  }
}

// Preview temporário no hover: mostra até a estrela sob o mouse, sem confirmar nada
function previsualizarEstrelas(valor) {
  estrelas.forEach((estrela, index) => {
    estrela.classList.toggle('preenchida', index < valor);
  });
}

estrelas.forEach((estrela, index) => {
  estrela.addEventListener('mouseenter', function () {
    previsualizarEstrelas(index + 1);
  });
});

// Ao tirar o mouse de cima de toda a fileira de estrelas, volta pro valor realmente selecionado
containerEstrelas.addEventListener('mouseleave', function () {
  const marcado = formulario.querySelector('input[name="nota"]:checked');
  atualizarEstrelas(marcado ? marcado.value : 0);
});

// ---------- CAMPO "OUTRO": mostra/esconde o input de detalhe ----------
function atualizarOutroDetalhe() {
  const marcado = radioOutro.checked;
  divOutroDetalhe.classList.toggle('oculto', !marcado);
  if (!marcado) {
    inputOutroDetalhe.value = '';
  }
}

// ---------- PROGRESSO DO BOTÃO (0/4 a 4/4) ----------
// Só conta como "respondido" se o campo realmente passar na validação —
// uma data absurda ou um "Outro" sem detalhe não fazem o botão avançar.
function contarProgresso() {
  const respostas = lerRespostas();

  return CAMPOS_PROGRESSO.filter((nome) => {
    const resultado = CAMPOS[nome].validar(respostas[nome] || '');
    return resultado.valido;
  }).length;
}

function atualizarProgressoBotao() {
  const progresso = contarProgresso();
  const total = CAMPOS_PROGRESSO.length;

  if (progresso >= total) {
    botaoEnviar.classList.remove('cb-08__btn--bloqueado');
    botaoEnviar.classList.add('cb-08__btn--pronto');
    botaoEnviar.removeAttribute('aria-disabled');
    fillBotaoEnviar.style.transform = ''; // devolve o controle pro CSS (hover normal)
  } else {
    botaoEnviar.classList.add('cb-08__btn--bloqueado');
    botaoEnviar.classList.remove('cb-08__btn--pronto');
    botaoEnviar.setAttribute('aria-disabled', 'true');
    fillBotaoEnviar.style.transform = `scaleX(${progresso / total})`;
  }
}

// ---------- BALANÇO: feedback ao tentar enviar/clicar ainda bloqueado ----------
function dispararBalancoBotao() {
  botaoEnviar.classList.remove('cb-08__btn--balancar');
  void botaoEnviar.offsetWidth; // força reflow, permite repetir a animação em cliques seguidos
  botaoEnviar.classList.add('cb-08__btn--balancar');
}

// ---------- VALIDAÇÃO EM TEMPO REAL (ao sair do campo) ----------
document.getElementById('nome-completo').addEventListener('blur', function () {
  validarCampo('nome-completo', this.value);
});

document.getElementById('nome-completo').addEventListener('input', function () {
  atualizarProgressoBotao();
});

document.getElementById('nascimento').addEventListener('blur', function () {
  validarCampo('nascimento', this.value);
});

document.getElementById('nascimento').addEventListener('change', function () {
  atualizarProgressoBotao();
});

formulario.querySelectorAll('input[name="tipo-participante"]').forEach((radio) => {
  radio.addEventListener('change', function () {
    validarCampo('tipo-participante', this.value);
    atualizarOutroDetalhe();
    atualizarProgressoBotao();
  });
});

// Enquanto a pessoa digita o que ela é (depois de marcar "Outro"), revalida em tempo real
inputOutroDetalhe.addEventListener('input', function () {
  const tipoMarcado = formulario.querySelector('input[name="tipo-participante"]:checked');
  validarCampo('tipo-participante', tipoMarcado ? tipoMarcado.value : '');
  atualizarProgressoBotao();
});

formulario.querySelectorAll('input[name="nota"]').forEach((radio) => {
  radio.addEventListener('change', function () {
    validarCampo('nota', this.value);
    atualizarEstrelas(this.value);
    atualizarProgressoBotao();
  });
});

document.getElementById('consentimento').addEventListener('change', function () {
  validarCampo('consentimento', this.checked ? 'sim' : '');
  atualizarProgressoBotao();
});

// ---------- CONTADOR DE CARACTERES + VALIDAÇÃO DA OPINIÃO ----------
campoOpiniao.addEventListener('input', function () {
  const tamanho = this.value.length;
  contadorOpiniao.textContent = `${tamanho}/${LIMITE_CARACTERES_OPINIAO}`;

  contadorOpiniao.classList.remove('contador-caracteres--alerta', 'contador-caracteres--estourado');
  if (tamanho > LIMITE_CARACTERES_OPINIAO) {
    contadorOpiniao.classList.add('contador-caracteres--estourado');
  } else if (tamanho >= LIMITE_CARACTERES_OPINIAO * 0.9) {
    contadorOpiniao.classList.add('contador-caracteres--alerta');
  }

  validarCampo('opiniao', this.value);
});

// ---------- RESET COMPLETO (usado quando o pop-up de erro é confirmado, ou após sucesso) ----------
function resetarFormularioCompleto() {
  formulario.reset();

  Object.keys(CAMPOS).forEach((nomeCampo) => {
    limparStatusCampo(nomeCampo);
    const config = CAMPOS[nomeCampo];
    if (config.elemento && !config.semClasseEstado) {
      config.elemento.classList.remove('campo-valido', 'campo-invalido');
    }
  });

  contadorOpiniao.textContent = `0/${LIMITE_CARACTERES_OPINIAO}`;
  contadorOpiniao.classList.remove('contador-caracteres--alerta', 'contador-caracteres--estourado');

  atualizarEstrelas(0);
  atualizarOutroDetalhe();
  atualizarProgressoBotao();

  document.getElementById('nome-completo').focus();
}

// ---------- FOCA NO PRIMEIRO CAMPO COM ERRO ----------
function focarPrimeiroErro(resultadoValidacao) {
  const ordem = ['nome-completo', 'nascimento', 'tipo-participante', 'nota', 'consentimento', 'opiniao'];
  const primeiroErro = ordem.find((nome) => !resultadoValidacao.campos[nome].valido);

  if (!primeiroErro) return;

  // Caso específico: marcou "Outro" mas não descreveu — foca no campo de texto, não no radio
  if (primeiroErro === 'tipo-participante' && radioOutro.checked) {
    inputOutroDetalhe.focus();
    return;
  }

  if (CAMPOS[primeiroErro].elemento) {
    CAMPOS[primeiroErro].elemento.focus();
  }
}

// ---------- ENVIO DO FORMULÁRIO ----------
formulario.addEventListener('submit', async function (event) {
  event.preventDefault();

  // Segunda camada de proteção (além do clique): cobre também quem aperta
  // Enter dentro de um campo de texto, que dispara "submit" sem passar pelo clique.
  if (botaoEnviar.classList.contains('cb-08__btn--bloqueado')) {
    dispararBalancoBotao();
    return;
  }

  const respostas = lerRespostas();
  const validacao = validarFormulario(respostas);

  // Mostra o status (✓/✗) de TODOS os campos, mesmo os que a pessoa não tocou ainda
  Object.keys(CAMPOS).forEach((nomeCampo) => {
    validarCampo(nomeCampo, respostas[nomeCampo] || '');
  });

  if (!validacao.valido) {
    focarPrimeiroErro(validacao);
    popupErro(function () {
      resetarFormularioCompleto();
    });
    return;
  }

  // Evita clique duplo enquanto a requisição está em andamento
  botaoEnviar.classList.add('cb-08__btn--bloqueado');
  botaoEnviar.setAttribute('aria-busy', 'true');

  try {
    await enviarResposta(respostas);

    popupSucesso(function () {
      resetarFormularioCompleto();
    });
  } catch (erro) {
    console.error(erro);

    // Erro de rede/backend é diferente de "formulário incorreto":
    // aqui os dados estavam certos, então NÃO reseta o formulário — deixa a pessoa tentar de novo.
    abrirPopup({
      tipo: 'erro',
      titulo: 'Não foi possível enviar',
      texto: 'Houve um problema de conexão. Seus dados não foram perdidos — tente enviar novamente.',
      textoBotao: 'Tentar novamente',
      aoConfirmar: () => {},
    });
  } finally {
    atualizarProgressoBotao(); // reaplica bloqueado/pronto de acordo com o progresso atual
    botaoEnviar.removeAttribute('aria-busy');
  }
});

// ---------- CLIQUE NO BOTÃO: balanço se bloqueado, glitch se pronto ----------
botaoEnviar.addEventListener('click', function (event) {
  if (botaoEnviar.classList.contains('cb-08__btn--bloqueado')) {
    event.preventDefault();
    dispararBalancoBotao();
    return;
  }

  botaoEnviar.classList.add('is-glitching');
  setTimeout(function () {
    botaoEnviar.classList.remove('is-glitching');
  }, 420);
});

// ---------- ESTADO INICIAL DA PÁGINA ----------
atualizarProgressoBotao();