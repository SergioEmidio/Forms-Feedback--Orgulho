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
  carregouEm = Date.now(); // reinicia a contagem, caso seja mostrado de novo depois
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

// Ao carregar a página inteira (imagens, CSS, etc.), esconde o overlay —
// respeitando um tempo mínimo de exibição, pra cobrir bem conexões lentas
// sem parecer instantâneo/brusco demais em conexões rápidas.
window.addEventListener('load', function () {
  const tempoDecorrido = Date.now() - carregouEm;
  const espera = Math.max(TEMPO_MINIMO_EXIBICAO_MS - tempoDecorrido, 0);
  setTimeout(esconderCarregamento, espera);
});