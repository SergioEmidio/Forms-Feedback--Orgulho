// components/carregando.js
// Overlay de carregamento reutilizável — usado em transições entre páginas
// (evita o "flash" branco/preto brusco de uma navegação normal) e também
// pode ser reaproveitado dentro da mesma página (ex: ao resetar o formulário
// depois de um envio, dando a sensação de "recarregando do zero").

const overlay = document.getElementById('tela-carregando');
const TEMPO_MINIMO_EXIBICAO_MS = 500;

let carregouEm = Date.now();

export function mostrarCarregamento() {
  if (!overlay) return;
  carregouEm = Date.now();
  document.body.classList.add('saindo'); // esmaece o conteúdo atual junto com o overlay entrando
  overlay.classList.remove('tela-carregando--escondida');
  overlay.setAttribute('aria-hidden', 'false');
}

export function esconderCarregamento() {
  if (!overlay) return;
  overlay.classList.add('tela-carregando--escondida');
  overlay.setAttribute('aria-hidden', 'true');
  // Libera as animações de entrada do conteúdo da página (ver form.css/login.css) —
  // sem isso, elas rodariam escondidas atrás do overlay e nunca seriam vistas.
  document.body.classList.add('conteudo-pronto');
  // Remove a classe que esmaece o conteúdo (opacity: 0 em #container-formulario /
  // #conteudo-dashboard / .login-card — ver carregando.css). Sem isso, depois de
  // usar mostrarCarregamento() DENTRO da mesma página (ex: resetar o formulário
  // após um envio com sucesso), o conteúdo ficava invisível pra sempre — só a
  // logo (que fica fora desses containers) continuava aparecendo na tela.
  document.body.classList.remove('saindo');
}

/**
 * Navega pra outra página só depois de mostrar o carregamento por um tempo
 * mínimo (evita uma transição "piscada" rápido demais em internet boa).
 */
export function navegarComCarregamento(url) {
  mostrarCarregamento();
  setTimeout(function () {
    window.location.href = url;
  }, TEMPO_MINIMO_EXIBICAO_MS);
}

// Esconde assim que o HTML + scripts terminarem de rodar — não espera imagens
// externas (como uma logo que ainda não existe) travarem a experiência.
document.addEventListener('DOMContentLoaded', function () {
  const tempoDecorrido = Date.now() - carregouEm;
  const espera = Math.max(TEMPO_MINIMO_EXIBICAO_MS - tempoDecorrido, 0);
  setTimeout(esconderCarregamento, espera);
});

// Rede de segurança: se por qualquer motivo (erro de import, arquivo faltando,
// script quebrado em outro lugar da página) nada esconder o overlay até aqui,
// força esconder depois de 4s — nunca deixa a pessoa presa numa tela infinita.
setTimeout(esconderCarregamento, 4000);