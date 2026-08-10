// pages/form.js
// Lógica exclusiva da página do formulário (junta tudo pra rodar)

import { enviarResposta } from '../services/respostasServices.js';
import { atualizarStatusCampo, limparStatusCampo } from '../components/mensagem.js';
import {
  validarNome,
  validarNascimento,
  validarTipoParticipante,
  validarNota,
  validarOpiniao,
  validarFormulario,
} from '../utils/validacao.js';
import { abrirPopup, popupSucesso, popupErro } from '../components/popup.js';
import { LIMITE_CARACTERES_OPINIAO } from '../config.js';

const formulario = document.getElementById('formulario-avaliacao');
const botaoEnviar = formulario.querySelector('.cb-08__btn');
const campoOpiniao = document.getElementById('opiniao');
const contadorOpiniao = document.getElementById('contador-opiniao');

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
    validar: validarTipoParticipante,
    semClasseEstado: true,
  },
  nota: {
    elemento: document.getElementById('nota-1'),
    validar: validarNota,
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

// ---------- VALIDAÇÃO EM TEMPO REAL (ao sair do campo) ----------
document.getElementById('nome-completo').addEventListener('blur', function () {
  validarCampo('nome-completo', this.value);
});

document.getElementById('nascimento').addEventListener('blur', function () {
  validarCampo('nascimento', this.value);
});

formulario.querySelectorAll('input[name="tipo-participante"]').forEach((radio) => {
  radio.addEventListener('change', function () {
    validarCampo('tipo-participante', this.value);
  });
});

formulario.querySelectorAll('input[name="nota"]').forEach((radio) => {
  radio.addEventListener('change', function () {
    validarCampo('nota', this.value);
  });
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

// ---------- RESET COMPLETO (usado quando o pop-up de erro é confirmado) ----------
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

  document.getElementById('nome-completo').focus();
}

// ---------- FOCA NO PRIMEIRO CAMPO COM ERRO ----------
function focarPrimeiroErro(resultadoValidacao) {
  const ordem = ['nome-completo', 'nascimento', 'tipo-participante', 'nota', 'opiniao'];
  const primeiroErro = ordem.find((nome) => !resultadoValidacao.campos[nome].valido);

  if (primeiroErro && CAMPOS[primeiroErro].elemento) {
    CAMPOS[primeiroErro].elemento.focus();
  }
}

// ---------- ENVIO DO FORMULÁRIO ----------
formulario.addEventListener('submit', async function (event) {
  event.preventDefault();

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
  botaoEnviar.disabled = true;
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
    botaoEnviar.disabled = false;
    botaoEnviar.removeAttribute('aria-busy');
  }
});

// ---------- EFEITO DE GLITCH NO BOTÃO AO CLICAR ----------
document.querySelectorAll('.cb-08__btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    btn.classList.add('is-glitching');
    setTimeout(function () {
      btn.classList.remove('is-glitching');
    }, 420);
  });
});