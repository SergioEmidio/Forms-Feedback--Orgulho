// components/popup.js
// Controla o modal de resultado do envio (sucesso/erro).
// Usa a estrutura do index.html:
//   #popup-overlay > .popup-caixa > #popup-icone, #popup-titulo, #popup-texto, #popup-botao

const overlay = document.getElementById('popup-overlay');
const caixa = overlay ? overlay.querySelector('.popup-caixa') : null;
const icone = document.getElementById('popup-icone');
const titulo = document.getElementById('popup-titulo');
const texto = document.getElementById('popup-texto');
const botao = document.getElementById('popup-botao');

let elementoComFocoAntes = null; // pra devolver o foco de onde o usuário estava, ao fechar
let aoConfirmarAtual = null;     // callback executado quando o botão do popup é clicado

/**
 * Abre o pop-up.
 * @param {Object} opcoes
 * @param {'sucesso'|'erro'} opcoes.tipo
 * @param {string} opcoes.titulo
 * @param {string} opcoes.texto
 * @param {string} opcoes.textoBotao
 * @param {Function} [opcoes.aoConfirmar] - roda quando o usuário clica no botão do popup
 */
export function abrirPopup({ tipo, titulo: tituloTexto, texto: corpoTexto, textoBotao, aoConfirmar }) {
  if (!overlay || !caixa) return;

  // Guarda o elemento focado antes de abrir (pra restaurar depois)
  elementoComFocoAntes = document.activeElement;
  aoConfirmarAtual = typeof aoConfirmar === 'function' ? aoConfirmar : null;

  // Aplica a variação visual (verde = sucesso, vermelho = erro)
  caixa.className = `popup-caixa popup-caixa--${tipo}`;

  icone.textContent = tipo === 'sucesso' ? '✓' : '✗';
  titulo.textContent = tituloTexto;
  texto.textContent = corpoTexto;
  botao.textContent = textoBotao;

  overlay.hidden = false;
  document.body.style.overflow = 'hidden'; // trava o scroll de fundo enquanto o popup está aberto

  // Move o foco pro botão do popup (acessibilidade: leitor de tela e teclado)
  botao.focus();

  document.addEventListener('keydown', aoPressionarTecla);
}

/** Fecha o pop-up e restaura o estado da página. */
export function fecharPopup() {
  if (!overlay) return;

  overlay.hidden = true;
  document.body.style.overflow = '';
  document.removeEventListener('keydown', aoPressionarTecla);

  // Devolve o foco pra onde o usuário estava antes de abrir o popup
  if (elementoComFocoAntes && typeof elementoComFocoAntes.focus === 'function') {
    elementoComFocoAntes.focus();
  }

  elementoComFocoAntes = null;
  aoConfirmarAtual = null;
}

/** Atalhos prontos pro form.js chamar direto, sem repetir textos toda vez. */
export function popupSucesso(aoConfirmar) {
  abrirPopup({
    tipo: 'sucesso',
    titulo: 'Formulário enviado com sucesso!',
    texto: 'Obrigado por avaliar a nossa apresentação.',
    textoBotao: 'OK',
    aoConfirmar,
  });
}

export function popupErro(aoConfirmar) {
  abrirPopup({
    tipo: 'erro',
    titulo: 'Formulário incorreto',
    texto: 'Você não preencheu as informações corretamente. Revise os campos destacados em vermelho.',
    textoBotao: 'Completar formulário',
    aoConfirmar,
  });
}

// ---------- EVENTOS INTERNOS ----------

// Clique no botão do popup: fecha e executa o callback (ex: resetar o formulário)
if (botao) {
  botao.addEventListener('click', function () {
    const callback = aoConfirmarAtual;
    fecharPopup();
    if (callback) callback();
  });
}

// Clique no fundo escurecido (fora da caixa) também fecha o popup, sem rodar o callback
if (overlay) {
  overlay.addEventListener('click', function (event) {
    if (event.target === overlay) {
      fecharPopup();
    }
  });
}

// Tecla ESC fecha o popup, sem rodar o callback
function aoPressionarTecla(event) {
  if (event.key === 'Escape') {
    fecharPopup();
    return;
  }

  // Mantém o foco preso dentro do popup enquanto ele está aberto (Tab não escapa pro fundo)
  if (event.key === 'Tab') {
    event.preventDefault();
    botao.focus();
  }
}