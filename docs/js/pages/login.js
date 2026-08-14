// pages/login.js
// Lógica exclusiva da tela de login.

import { fazerLogin, salvarToken } from '../services/authServices.js';
import { abrirPopup } from '../components/popup.js';
import { navegarComCarregamento } from '../components/carregando.js';

const formulario = document.getElementById('formulario-login');
const botaoEntrar = formulario.querySelector('.cb-08__btn');
const campoUsuario = document.getElementById('usuario');
const campoSenha = document.getElementById('senha');
const botaoMostrarSenha = document.getElementById('botao-mostrar-senha');

// ---------- MOSTRAR/ESCONDER SENHA ----------
botaoMostrarSenha.addEventListener('click', function () {
  const estaVisivel = campoSenha.type === 'text';
  campoSenha.type = estaVisivel ? 'password' : 'text';
  botaoMostrarSenha.textContent = estaVisivel ? '👁' : '🙈';
  botaoMostrarSenha.setAttribute('aria-label', estaVisivel ? 'Mostrar senha' : 'Esconder senha');
});

// ---------- ENVIO DO LOGIN ----------
formulario.addEventListener('submit', async function (event) {
  event.preventDefault();

  const usuario = campoUsuario.value.trim();
  const senha = campoSenha.value;

  if (!usuario || !senha) {
    abrirPopup({
      tipo: 'erro',
      titulo: 'Campos obrigatórios',
      texto: 'Preencha o usuário e a senha para continuar.',
      textoBotao: 'Entendi',
      aoConfirmar: () => {},
    });
    return;
  }

  botaoEntrar.disabled = true;
  botaoEntrar.setAttribute('aria-busy', 'true');

  try {
    const resposta = await fazerLogin(usuario, senha);
    salvarToken(resposta.token);

    abrirPopup({
      tipo: 'sucesso',
      titulo: 'Login realizado!',
      texto: 'Você será redirecionado para o dashboard.',
      textoBotao: 'Continuar',
      aoConfirmar: function () {
        navegarComCarregamento('dashboard.html');
      },
    });
  } catch (erro) {
    console.error(erro);

    const foiCredencialInvalida = erro.status === 401;

    abrirPopup({
      tipo: 'erro',
      titulo: foiCredencialInvalida ? 'Usuário ou senha incorretos' : 'Não foi possível entrar',
      texto: foiCredencialInvalida
        ? 'Confira as credenciais e tente novamente.'
        : 'Houve um problema de conexão com o servidor. Tente novamente.',
      textoBotao: 'Tentar novamente',
      aoConfirmar: function () {
        campoSenha.value = '';
        campoSenha.focus();
      },
    });
  } finally {
    botaoEntrar.disabled = false;
    botaoEntrar.removeAttribute('aria-busy');
  }
});