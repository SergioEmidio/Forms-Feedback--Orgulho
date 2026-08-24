// pages/dashboard.js
// Dashboard completo: KPIs, gráficos (alternância + porcentagem + tooltip),
// filtros, ordenação, paginação, seleção múltipla, exclusão com desfazer,
// painel de detalhe, exportar CSV, modo apresentação, densidade da tabela,
// menu de usuário, "última atualização" e contador de resultados filtrados.

import { estaLogado, limparToken } from '../services/authServices.js';
import { buscarRespostas, deletarResposta } from '../services/respostasServices.js';
import { calcularResumo } from '../services/resumoService.js';
import { renderizarBarras, renderizarLinha, renderizarDonut, renderizarSparkline } from '../components/grafico.js';
import { abrirPopup } from '../components/popup.js';
import { navegarComCarregamento } from '../components/carregando.js';

// ---------- PROTEÇÃO DE ACESSO (com exceção só pra localhost/Live Server) ----------
const EH_AMBIENTE_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);

if (!estaLogado() && !EH_AMBIENTE_LOCAL) {
  window.location.href = 'login.html';
} else {
  if (EH_AMBIENTE_LOCAL && !estaLogado()) {
    console.warn('[modo dev] Login pulado (ambiente local). Isso nunca acontece fora do seu computador.');
  }
  aplicarTemaSalvo();
  iniciarDashboard();
}

// ---------- ESTADO GLOBAL ----------
let respostasOriginais = [];
let ordenacaoAtual = { coluna: 'enviado-em', direcao: 'desc' };
let paginaAtual = 1;
const ITENS_POR_PAGINA = 20;

let mostrarPercentual = false;
let tipoGraficoNotas = 'barras';
let tipoGraficoTipos = 'rosca';
let periodoAtivo = 'todos'; // 'todos' | 'hoje' | '7' | '30'

const idsSelecionados = new Set();
let idsConhecidos = new Set(); // pra detectar quais respostas são "novas" num refresh
let maiorMarcoComemorado = 0;
const CORES_GRAFICO = ['#00fff9', '#4ade80', '#f87171', '#ffb800'];

const STOPWORDS = new Set([
  'de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'com', 'não', 'uma', 'os',
  'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'ao', 'ele', 'das', 'seu',
  'sua', 'ou', 'quando', 'muito', 'nos', 'já', 'eu', 'também', 'só', 'pelo', 'pela', 'até',
  'isso', 'ela', 'entre', 'depois', 'sem', 'mesmo', 'aos', 'seus', 'quem', 'nas', 'me',
  'esse', 'eles', 'você', 'essa', 'num', 'nem', 'suas', 'meu', 'foi', 'ser', 'tem', 'ter',
  'está', 'estava', 'gostei', 'achei', 'muita', 'muitos', 'minha', 'este', 'esta',
]);

function gerarRespostasFicticias() {
  const tipos = ['Aluno', 'Ex-aluno', 'Responsável', 'Outro'];
  const opinioes = [
    'Muito boa a apresentação, gostei bastante da dinâmica.',
    'Podia ter mais tempo pra perguntas no final.',
    '',
    'Excelente! Só melhoraria o áudio da sala.',
    'Achei um pouco longa, mas o conteúdo foi ótimo.',
    '',
    'Parabéns a todos os envolvidos, ficou muito profissional.',
  ];

  return Array.from({ length: 23 }, (_, i) => {
    const ano = 1975 + Math.floor(Math.random() * 35);
    const mes = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
    const dia = String(1 + Math.floor(Math.random() * 27)).padStart(2, '0');

    const enviadoEm = new Date(Date.now() - Math.floor(Math.random() * 6) * 86400000 - Math.floor(Math.random() * 86400000));

    return {
      id: i + 1,
      'nome-completo': `Pessoa Fictícia ${i + 1}`,
      nascimento: `${ano}-${mes}-${dia}`,
      'tipo-participante': tipos[Math.floor(Math.random() * tipos.length)],
      nota: String(1 + Math.floor(Math.random() * 10)),
      opiniao: opinioes[Math.floor(Math.random() * opinioes.length)],
      'enviado-em': enviadoEm.toISOString(),
    };
  });
}

async function iniciarDashboard() {
  ligarEventosFixos();
  lerFiltrosDaURL();

  try {
    respostasOriginais = await buscarRespostas();
    idsConhecidos = new Set(respostasOriginais.map((r) => String(r.id)));
    marcarUltimaAtualizacao();
    renderizarTudo();
  } catch (erro) {
    if (EH_AMBIENTE_LOCAL) {
      console.warn('[modo dev] Sem backend real ainda — usando dados fictícios.');
      respostasOriginais = gerarRespostasFicticias();
      idsConhecidos = new Set(respostasOriginais.map((r) => String(r.id)));
      marcarUltimaAtualizacao();
      renderizarTudo();
      return;
    }
    tratarErroCarregamento(erro);
  }
}

// ---------- TEMA CLARO/ESCURO ----------
function aplicarTemaSalvo() {
  const salvo = localStorage.getItem('dashboard_tema');
  if (salvo === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

function alternarTema() {
  const atual = document.documentElement.getAttribute('data-theme');
  const novo = atual === 'light' ? 'dark' : 'light';

  if (novo === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  localStorage.setItem('dashboard_tema', novo);
  document.getElementById('icone-tema').textContent = novo === 'light' ? '☀️' : '🌙';
}

// ---------- FILTROS NA URL (compartilhar link) ----------
function lerFiltrosDaURL() {
  const parametros = new URLSearchParams(window.location.search);

  if (parametros.has('busca')) document.getElementById('filtro-busca').value = parametros.get('busca');
  if (parametros.has('tipo')) document.getElementById('filtro-tipo').value = parametros.get('tipo');
  if (parametros.has('notaMin')) document.getElementById('filtro-nota-min').value = parametros.get('notaMin');
  if (parametros.has('periodo')) {
    periodoAtivo = parametros.get('periodo');
    document.querySelectorAll('.filtro-periodo__botao').forEach((b) => {
      b.classList.toggle('filtro-periodo__botao--ativo', b.dataset.periodo === periodoAtivo);
    });
  }
}

function atualizarURLComFiltros() {
  const parametros = new URLSearchParams();
  const busca = document.getElementById('filtro-busca').value.trim();
  const tipo = document.getElementById('filtro-tipo').value;
  const notaMin = document.getElementById('filtro-nota-min').value;

  if (busca) parametros.set('busca', busca);
  if (tipo) parametros.set('tipo', tipo);
  if (notaMin) parametros.set('notaMin', notaMin);
  if (periodoAtivo !== 'todos') parametros.set('periodo', periodoAtivo);

  const query = parametros.toString();
  const novaURL = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history.replaceState({}, '', novaURL);
}

async function copiarLinkComFiltros() {
  atualizarURLComFiltros();
  try {
    await navigator.clipboard.writeText(window.location.href);
    mostrarToastSimples('Link copiado com os filtros aplicados!');
  } catch (erro) {
    console.error('Não foi possível copiar o link:', erro);
    mostrarToastSimples('Não foi possível copiar o link.');
  }
}

// ---------- FILTROS SALVOS (localStorage) ----------
function obterFiltrosSalvos() {
  try {
    return JSON.parse(localStorage.getItem('dashboard_filtros_salvos') || '[]');
  } catch {
    return [];
  }
}

function salvarFiltroAtual() {
  const nome = window.prompt('Nome pra esse filtro (ex: "Alunos nota baixa"):');
  if (!nome) return;

  const filtros = {
    busca: document.getElementById('filtro-busca').value,
    tipo: document.getElementById('filtro-tipo').value,
    notaMin: document.getElementById('filtro-nota-min').value,
    periodo: periodoAtivo,
  };

  const salvos = obterFiltrosSalvos();
  salvos.push({ nome, filtros });
  localStorage.setItem('dashboard_filtros_salvos', JSON.stringify(salvos));
  renderizarListaFiltrosSalvos();
}

function aplicarFiltroSalvo(filtros) {
  document.getElementById('filtro-busca').value = filtros.busca || '';
  document.getElementById('filtro-tipo').value = filtros.tipo || '';
  document.getElementById('filtro-nota-min').value = filtros.notaMin || '';
  periodoAtivo = filtros.periodo || 'todos';
  document.querySelectorAll('.filtro-periodo__botao').forEach((b) => {
    b.classList.toggle('filtro-periodo__botao--ativo', b.dataset.periodo === periodoAtivo);
  });
  paginaAtual = 1;
  renderizarGraficosComTransicao();
  renderizarTabelaComTransicao();
}

function removerFiltroSalvo(indice) {
  const salvos = obterFiltrosSalvos();
  salvos.splice(indice, 1);
  localStorage.setItem('dashboard_filtros_salvos', JSON.stringify(salvos));
  renderizarListaFiltrosSalvos();
}

function renderizarListaFiltrosSalvos() {
  const lista = document.getElementById('lista-filtros-salvos');
  const salvos = obterFiltrosSalvos();

  if (salvos.length === 0) {
    lista.innerHTML = '<p style="font-size:11px;color:var(--color-text-muted);padding:4px 8px;">Nenhum filtro salvo ainda.</p>';
    return;
  }

  lista.innerHTML = salvos
    .map(
      (item, indice) => `
        <div class="filtro-salvo-item">
          <span class="filtro-salvo-item__nome" data-indice="${indice}">${escaparHtml(item.nome)}</span>
          <button type="button" class="filtro-salvo-item__remover" data-remover="${indice}" aria-label="Remover filtro salvo">✕</button>
        </div>
      `
    )
    .join('');

  lista.querySelectorAll('.filtro-salvo-item__nome').forEach((el) => {
    el.addEventListener('click', function () {
      const indice = Number(el.dataset.indice);
      aplicarFiltroSalvo(salvos[indice].filtros);
      document.getElementById('dropdown-filtros-salvos').hidden = true;
    });
  });

  lista.querySelectorAll('.filtro-salvo-item__remover').forEach((el) => {
    el.addEventListener('click', function (evento) {
      evento.stopPropagation();
      removerFiltroSalvo(Number(el.dataset.remover));
    });
  });
}

// ---------- TOAST SIMPLES (reaproveita o visual do toast de desfazer) ----------
function mostrarToastSimples(mensagem) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${escaparHtml(mensagem)}</span>`;
  container.appendChild(toast);

  setTimeout(function () {
    toast.classList.add('toast--saindo');
    setTimeout(function () {
      toast.remove();
    }, 220);
  }, 2200);
}

// ---------- EVENTOS FIXOS ----------
// on(): registra um listener com segurança. Se o elemento não existir na
// página, avisa no Console e SEGUE EM FRENTE, em vez de travar a função
// inteira (o que faria todo listener registrado DEPOIS dele nunca funcionar).
function on(id, evento, handler) {
  const elemento = document.getElementById(id);
  if (!elemento) {
    console.warn(`[dashboard] Elemento #${id} não encontrado no HTML — esse listener foi pulado, mas o resto da página continua funcionando.`);
    return null;
  }
  elemento.addEventListener(evento, handler);
  return elemento;
}

function ligarEventosFixos() {
  on('botao-sair', 'click', function () {
    limparToken();
    navegarComCarregamento('login.html');
  });

  // Menu do usuário (dropdown)
  const botaoUsuario = document.getElementById('botao-usuario');
  const dropdown = document.getElementById('menu-usuario-dropdown');
  if (botaoUsuario && dropdown) {
    botaoUsuario.addEventListener('click', function (evento) {
      evento.stopPropagation();
      const aberto = !dropdown.hidden;
      dropdown.hidden = aberto;
      botaoUsuario.setAttribute('aria-expanded', String(!aberto));
    });
    document.addEventListener('click', function () {
      dropdown.hidden = true;
      botaoUsuario.setAttribute('aria-expanded', 'false');
    });
  } else {
    console.warn('[dashboard] Menu de usuário não encontrado (#botao-usuario ou #menu-usuario-dropdown).');
  }

  // Sombra da navbar ao rolar
  window.addEventListener('scroll', function () {
    const navbar = document.getElementById('navbar-projeto');
    if (navbar) navbar.classList.toggle('navbar-projeto--rolada', window.scrollY > 8);
  });

  // Modo apresentação
  on('botao-apresentacao', 'click', ativarModoApresentacao);
  on('botao-sair-apresentacao', 'click', desativarModoApresentacao);

  // Densidade da tabela
  on('botao-densidade', 'click', function () {
    const tabela = document.getElementById('tabela-respostas');
    if (tabela) tabela.classList.toggle('tabela-compacta');
  });

  on('botao-atualizar', 'click', atualizarDados);
  on('botao-tema', 'click', alternarTema);
  on('botao-copiar-link', 'click', copiarLinkComFiltros);

  // Dropdown de filtros salvos
  const botaoFiltrosSalvos = document.getElementById('botao-filtros-salvos');
  const dropdownFiltrosSalvos = document.getElementById('dropdown-filtros-salvos');
  if (botaoFiltrosSalvos && dropdownFiltrosSalvos) {
    botaoFiltrosSalvos.addEventListener('click', function (evento) {
      evento.stopPropagation();
      const aberto = !dropdownFiltrosSalvos.hidden;
      dropdownFiltrosSalvos.hidden = aberto;
      if (!aberto) renderizarListaFiltrosSalvos();
    });
    document.addEventListener('click', function () {
      dropdownFiltrosSalvos.hidden = true;
    });
  } else {
    console.warn('[dashboard] Dropdown de filtros salvos não encontrado (#botao-filtros-salvos ou #dropdown-filtros-salvos).');
  }

  on('botao-salvar-filtro-atual', 'click', function (evento) {
    evento.stopPropagation();
    salvarFiltroAtual();
  });

  on('botao-fechar-filtros-salvos', 'click', function (evento) {
    evento.stopPropagation();
    if (dropdownFiltrosSalvos) dropdownFiltrosSalvos.hidden = true;
  });

  // Atalhos de teclado: "/" foca a busca, "Esc" fecha painéis abertos
  document.addEventListener('keydown', function (evento) {
    const digitandoEmCampo = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);

    if (evento.key === '/' && !digitandoEmCampo) {
      evento.preventDefault();
      const busca = document.getElementById('filtro-busca');
      if (busca) busca.focus();
    }

    if (evento.key === 'Escape') {
      fecharPainelDetalhe();
      if (dropdown) dropdown.hidden = true;
      if (dropdownFiltrosSalvos) dropdownFiltrosSalvos.hidden = true;
      if (document.body.classList.contains('modo-apresentacao')) desativarModoApresentacao();
    }
  });

  document.querySelectorAll('.filtro-periodo__botao').forEach((botao) => {
    botao.addEventListener('click', function () {
      document.querySelectorAll('.filtro-periodo__botao').forEach((b) => {
        b.classList.remove('filtro-periodo__botao--ativo');
      });
      botao.classList.add('filtro-periodo__botao--ativo');
      periodoAtivo = botao.dataset.periodo;
      paginaAtual = 1;
      renderizarGraficosComTransicao();
      renderizarTabelaComTransicao();
    });
  });

  on('botao-limpar-filtros', 'click', limparTodosOsFiltros);
  on('botao-limpar-filtros-vazio', 'click', limparTodosOsFiltros);

  on('toggle-percentual', 'change', function (evento) {
    mostrarPercentual = evento.target.checked;
    renderizarGraficosComTransicao();
  });

  document.querySelectorAll('.botao-tipo-grafico').forEach((botao) => {
    botao.addEventListener('click', function () {
      const grupo = botao.dataset.grafico;
      const grupoBotoes = document.querySelectorAll(`.botao-tipo-grafico[data-grafico="${grupo}"]`);
      grupoBotoes.forEach((b) => b.classList.remove('botao-tipo-grafico--ativo'));
      botao.classList.add('botao-tipo-grafico--ativo');
      posicionarPilula(botao);

      if (grupo === 'notas') tipoGraficoNotas = botao.dataset.tipo;
      if (grupo === 'tipos') tipoGraficoTipos = botao.dataset.tipo;
      renderizarGraficosComTransicao();
    });
  });

  document.querySelectorAll('.th-ordenavel').forEach((th) => {
    th.addEventListener('click', function () {
      const coluna = th.dataset.coluna;
      if (ordenacaoAtual.coluna === coluna) {
        ordenacaoAtual.direcao = ordenacaoAtual.direcao === 'asc' ? 'desc' : 'asc';
      } else {
        ordenacaoAtual = { coluna, direcao: 'asc' };
      }
      atualizarIndicadorOrdenacao();
      paginaAtual = 1;
      renderizarTabelaComTransicao();
    });
  });

  on('filtro-busca', 'input', function () {
    paginaAtual = 1;
    renderizarGraficosComTransicao();
    renderizarTabelaComTransicao();
  });
  on('filtro-tipo', 'change', function () {
    paginaAtual = 1;
    renderizarGraficosComTransicao();
    renderizarTabelaComTransicao();
  });
  on('filtro-nota-min', 'change', function () {
    paginaAtual = 1;
    renderizarGraficosComTransicao();
    renderizarTabelaComTransicao();
  });

  on('botao-exportar-csv', 'click', exportarCSV);

  on('checkbox-selecionar-todos', 'change', function (evento) {
    const respostasVisiveis = obterRespostasFiltradas();
    if (evento.target.checked) {
      respostasVisiveis.forEach((r) => idsSelecionados.add(String(r.id)));
    } else {
      respostasVisiveis.forEach((r) => idsSelecionados.delete(String(r.id)));
    }
    renderizarTabela();
  });

  on('botao-limpar-selecao', 'click', function () {
    idsSelecionados.clear();
    renderizarTabela();
  });

  on('botao-excluir-selecionados', 'click', function () {
    confirmarExclusao(Array.from(idsSelecionados));
  });

  on('botao-pagina-anterior', 'click', function () {
    if (paginaAtual > 1) {
      paginaAtual--;
      renderizarTabela();
    }
  });
  on('botao-pagina-proxima', 'click', function () {
    paginaAtual++;
    renderizarTabela();
  });

  on('botao-fechar-detalhe', 'click', fecharPainelDetalhe);
  on('painel-detalhe-overlay', 'click', function (evento) {
    if (evento.target.id === 'painel-detalhe-overlay') fecharPainelDetalhe();
  });

  // Posiciona a pílula deslizante corretamente assim que a página carrega
  document.querySelectorAll('.grafico-card__alternador').forEach((grupo) => {
    const ativo = grupo.querySelector('.botao-tipo-grafico--ativo');
    if (ativo) posicionarPilula(ativo);
  });
}

// ---------- MODO APRESENTAÇÃO ----------
function ativarModoApresentacao() {
  document.body.classList.add('modo-apresentacao');
  document.getElementById('botao-sair-apresentacao').hidden = false;
}

function desativarModoApresentacao() {
  document.body.classList.remove('modo-apresentacao');
  document.getElementById('botao-sair-apresentacao').hidden = true;
}

// ---------- PÍLULA DESLIZANTE ----------
function posicionarPilula(botaoAtivo) {
  const grupo = botaoAtivo.closest('.grafico-card__alternador');
  const pilula = grupo.querySelector('.pilula-deslizante');
  pilula.style.width = `${botaoAtivo.offsetWidth}px`;
  pilula.style.transform = `translateX(${botaoAtivo.offsetLeft - 2}px)`;
}

// ---------- ATUALIZAR ----------
async function atualizarDados() {
  const icone = document.getElementById('icone-atualizar');
  icone.classList.add('icone-atualizar--girando');
  const totalAntes = respostasOriginais.length;

  try {
    respostasOriginais = await buscarRespostas();
    idsSelecionados.clear();
    marcarUltimaAtualizacao(respostasOriginais.length !== totalAntes);
    renderizarTudo();
  } catch (erro) {
    if (EH_AMBIENTE_LOCAL) {
      console.warn('[modo dev] Atualizar falhou (sem backend real) — mantendo dados fictícios.');
      idsSelecionados.clear();
      marcarUltimaAtualizacao();
      renderizarTudo();
    } else {
      tratarErroCarregamento(erro);
    }
  } finally {
    icone.classList.remove('icone-atualizar--girando');
  }
}

function marcarUltimaAtualizacao(houveNovidade) {
  const agora = new Date();
  const horario = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('texto-ultima-atualizacao').textContent = `Atualizado às ${horario}`;

  if (houveNovidade) {
    const elemento = document.querySelector('.ultima-atualizacao');
    elemento.classList.add('ultima-atualizacao--novidade');
    setTimeout(function () {
      elemento.classList.remove('ultima-atualizacao--novidade');
    }, 1600);
  }
}

function tratarErroCarregamento(erro) {
  console.error(erro);

  if (erro.status === 401) {
    limparToken();
    abrirPopup({
      tipo: 'erro',
      titulo: 'Sessão expirada',
      texto: 'Faça login novamente para continuar vendo os resultados.',
      textoBotao: 'Ir para o login',
      aoConfirmar: function () {
        navegarComCarregamento('login.html');
      },
    });
    return;
  }

  abrirPopup({
    tipo: 'erro',
    titulo: 'Não foi possível carregar os dados',
    texto: 'Houve um problema de conexão com o servidor. Tente novamente.',
    textoBotao: 'Tentar novamente',
    aoConfirmar: function () {
      window.location.reload();
    },
  });
}

// ---------- FILTROS + ORDENAÇÃO ----------
function obterRespostasFiltradas() {
  const busca = document.getElementById('filtro-busca').value.trim().toLowerCase();
  const tipo = document.getElementById('filtro-tipo').value;
  const notaMinima = document.getElementById('filtro-nota-min').value;
  const limitePeriodo = calcularLimitePeriodo();

  let filtradas = respostasOriginais.filter((r) => {
    const nome = (r['nome-completo'] || '').toLowerCase();
    if (busca && !nome.includes(busca)) return false;
    if (tipo && r['tipo-participante'] !== tipo) return false;
    if (notaMinima && Number(r.nota) < Number(notaMinima)) return false;

    if (limitePeriodo) {
      const enviadoEm = r['enviado-em'] ? new Date(r['enviado-em']) : null;
      if (!enviadoEm || enviadoEm < limitePeriodo) return false;
    }

    return true;
  });

  if (ordenacaoAtual.coluna) {
    filtradas = [...filtradas].sort((a, b) => {
      const valorA = a[ordenacaoAtual.coluna] ?? '';
      const valorB = b[ordenacaoAtual.coluna] ?? '';
      const comparacao = String(valorA).localeCompare(String(valorB), 'pt-BR', { numeric: true });
      return ordenacaoAtual.direcao === 'asc' ? comparacao : -comparacao;
    });
  }

  return filtradas;
}

function limparTodosOsFiltros() {
  document.getElementById('filtro-busca').value = '';
  document.getElementById('filtro-tipo').value = '';
  document.getElementById('filtro-nota-min').value = '';
  periodoAtivo = 'todos';
  document.querySelectorAll('.filtro-periodo__botao').forEach((b) => {
    b.classList.toggle('filtro-periodo__botao--ativo', b.dataset.periodo === 'todos');
  });
  paginaAtual = 1;
  renderizarGraficosComTransicao();
  renderizarTabelaComTransicao();
}

/** Calcula a data limite (Date) do filtro de período ativo, ou null se for "todos". */
function calcularLimitePeriodo() {
  const agora = new Date();

  if (periodoAtivo === 'hoje') {
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  }
  if (periodoAtivo === '7') {
    return new Date(agora.getTime() - 7 * 86400000);
  }
  if (periodoAtivo === '30') {
    return new Date(agora.getTime() - 30 * 86400000);
  }
  return null;
}

function atualizarIndicadorOrdenacao() {
  document.querySelectorAll('.th-ordenavel').forEach((th) => {
    th.classList.remove('th-ordenavel--asc', 'th-ordenavel--desc');
    if (th.dataset.coluna === ordenacaoAtual.coluna) {
      th.classList.add(ordenacaoAtual.direcao === 'asc' ? 'th-ordenavel--asc' : 'th-ordenavel--desc');
    }
  });
}

// ---------- TRANSIÇÕES SUAVES (fade ao trocar filtro/gráfico) ----------
function comTransicaoSuave(elemento, funcaoRenderizar) {
  elemento.classList.add('conteudo-atualizando');
  setTimeout(function () {
    funcaoRenderizar();
    requestAnimationFrame(function () {
      elemento.classList.remove('conteudo-atualizando');
    });
  }, 120);
}

function renderizarGraficosComTransicao() {
  atualizarURLComFiltros();
  comTransicaoSuave(document.querySelector('.graficos'), function () {
    renderizarGraficos();
    renderizarComparacaoPorTipo();
    renderizarNuvemPalavras();
  });
}

function renderizarTabelaComTransicao() {
  comTransicaoSuave(document.getElementById('secao-tabela'), renderizarTabela);
}

// ---------- RENDERIZAÇÃO GERAL ----------
function renderizarTudo() {
  renderizarKPIs();
  renderizarSparklines();
  renderizarResumoExecutivo();
  renderizarGraficos();
  renderizarComparacaoPorTipo();
  renderizarNuvemPalavras();
  renderizarTabela();
  atualizarContadorFiltrados();
  verificarCelebracao();
}

// ---------- KPIs (contagem animada) ----------
function renderizarKPIs() {
  const resumo = calcularResumo(respostasOriginais);

  const elTotal = document.getElementById('kpi-total');
  const elNotaMedia = document.getElementById('kpi-nota-media');
  const elTipoComum = document.getElementById('kpi-tipo-comum');

  [elTotal, elNotaMedia, elTipoComum].forEach((el) => el.classList.add('skeleton-linha--pronto'));

  animarNumero(elTotal, resumo.total, 0);
  animarNumero(elNotaMedia, resumo.total ? resumo.notaMedia : 0, 1, resumo.total ? '' : '—');

  const tipoMaisComum = Object.entries(resumo.porTipo).sort((a, b) => b[1] - a[1])[0];
  elTipoComum.textContent = tipoMaisComum ? tipoMaisComum[0] : '—';
}

function animarNumero(elemento, valorFinal, decimais, textoSeVazio) {
  if (textoSeVazio !== undefined && valorFinal === 0) {
    elemento.textContent = textoSeVazio;
    return;
  }

  const duracao = 600;
  const inicio = performance.now();

  function passo(agora) {
    const progresso = Math.min((agora - inicio) / duracao, 1);
    const atual = valorFinal * progresso;
    elemento.textContent = decimais ? atual.toFixed(decimais) : Math.round(atual);
    if (progresso < 1) requestAnimationFrame(passo);
  }

  requestAnimationFrame(passo);
}

// ---------- SPARKLINES (tendência dos últimos 7 dias, dentro dos KPIs) ----------
function renderizarSparklines() {
  const dias = Array.from({ length: 7 }, (_, i) => {
    const data = new Date();
    data.setDate(data.getDate() - (6 - i));
    return data.toISOString().slice(0, 10);
  });

  const totalPorDia = dias.map((dia) =>
    respostasOriginais.filter((r) => (r['enviado-em'] || '').slice(0, 10) === dia).length
  );

  const notaMediaPorDia = dias.map((dia) => {
    const doD = respostasOriginais.filter((r) => (r['enviado-em'] || '').slice(0, 10) === dia);
    if (doD.length === 0) return 0;
    return doD.reduce((soma, r) => soma + Number(r.nota || 0), 0) / doD.length;
  });

  renderizarSparkline(document.getElementById('sparkline-total'), totalPorDia);
  renderizarSparkline(document.getElementById('sparkline-nota'), notaMediaPorDia);
}

// ---------- RESUMO EXECUTIVO (texto gerado automaticamente) ----------
function renderizarResumoExecutivo() {
  const elemento = document.getElementById('texto-resumo-executivo');
  elemento.classList.remove('skeleton-linha', 'skeleton-linha--bloco');

  const resumo = calcularResumo(respostasOriginais);

  if (resumo.total === 0) {
    elemento.textContent = 'Ainda não há respostas suficientes para gerar um resumo.';
    return;
  }

  const classificacao =
    resumo.notaMedia >= 8 ? 'muito positiva' : resumo.notaMedia >= 6 ? 'positiva' : resumo.notaMedia >= 4 ? 'neutra' : 'crítica';

  const tiposOrdenados = Object.entries(resumo.porTipo).sort((a, b) => b[1] - a[1]);
  const tipoMaisComum = tiposOrdenados[0];
  const percentualTipoComum = Math.round((tipoMaisComum[1] / resumo.total) * 100);

  const comOpiniao = respostasOriginais.filter((r) => (r.opiniao || '').trim().length > 0).length;
  const percentualOpiniao = Math.round((comOpiniao / resumo.total) * 100);

  elemento.textContent =
    `Com base em ${resumo.total} resposta${resumo.total > 1 ? 's' : ''}, a avaliação geral foi ${classificacao} ` +
    `(nota média ${resumo.notaMedia.toFixed(1)}/10). A maioria dos participantes é do tipo "${tipoMaisComum[0]}" ` +
    `(${percentualTipoComum}% do total), e ${percentualOpiniao}% deixaram um comentário escrito.`;
}

// ---------- COMPARAÇÃO DE NOTA MÉDIA POR TIPO ----------
function renderizarComparacaoPorTipo() {
  const respostasVisiveis = obterRespostasFiltradas();
  const porTipo = {};

  respostasVisiveis.forEach((r) => {
    const tipo = r['tipo-participante'] || 'Não informado';
    if (!porTipo[tipo]) porTipo[tipo] = { soma: 0, quantidade: 0 };
    porTipo[tipo].soma += Number(r.nota || 0);
    porTipo[tipo].quantidade += 1;
  });

  const dados = Object.entries(porTipo).map(([rotulo, { soma, quantidade }]) => {
    const media = quantidade ? soma / quantidade : 0;
    return { rotulo, valor: Number(media.toFixed(1)), textoExibido: media.toFixed(1) };
  });

  const container = document.getElementById('grafico-comparacao-tipo');
  if (dados.length === 0) {
    container.innerHTML = '<p style="color:var(--color-text-muted);font-size:13px;text-align:center;padding:24px;">Sem dados suficientes.</p>';
    return;
  }

  renderizarBarras(container, dados);
  ativarTooltipGrafico(container);
}

// ---------- NUVEM DE PALAVRAS (a partir das opiniões) ----------
function renderizarNuvemPalavras() {
  const container = document.getElementById('nuvem-palavras');
  const respostasVisiveis = obterRespostasFiltradas();

  const contagem = {};
  respostasVisiveis.forEach((r) => {
    const palavras = (r.opiniao || '')
      .toLowerCase()
      .replace(/[.,!?;:()"']/g, '')
      .split(/\s+/)
      .filter((p) => p.length > 2 && !STOPWORDS.has(p));

    palavras.forEach((p) => {
      contagem[p] = (contagem[p] || 0) + 1;
    });
  });

  const palavrasOrdenadas = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25);

  if (palavrasOrdenadas.length === 0) {
    container.innerHTML = '<p class="nuvem-palavras__vazio">Nenhuma opinião suficiente ainda pra gerar a nuvem de palavras.</p>';
    return;
  }

  const maiorFrequencia = palavrasOrdenadas[0][1];

  container.innerHTML = palavrasOrdenadas
    .map(([palavra, frequencia], i) => {
      const tamanho = 12 + (frequencia / maiorFrequencia) * 22; // entre 12px e 34px
      const atraso = i * 25;
      return `<span class="nuvem-palavras__item" style="font-size:${tamanho.toFixed(0)}px; animation-delay:${atraso}ms;" title="${frequencia}x">${escaparHtml(palavra)}</span>`;
    })
    .join('');
}

// ---------- CELEBRAÇÃO (confete ao bater marcos de 50 respostas) ----------
function verificarCelebracao() {
  const total = respostasOriginais.length;
  const marco = Math.floor(total / 50) * 50;

  if (marco > 0 && marco > maiorMarcoComemorado) {
    maiorMarcoComemorado = marco;
    dispararConfete(`🎉 ${marco} respostas alcançadas!`);
  }
}

function dispararConfete(mensagem) {
  const cores = ['#00fff9', '#4ade80', '#f87171', '#ffb800'];
  const container = document.createElement('div');
  container.className = 'confete-container';
  document.body.appendChild(container);

  for (let i = 0; i < 40; i++) {
    const particula = document.createElement('span');
    particula.className = 'confete-particula';
    particula.style.left = `${Math.random() * 100}%`;
    particula.style.background = cores[i % cores.length];
    particula.style.animationDuration = `${1800 + Math.random() * 1200}ms`;
    particula.style.animationDelay = `${Math.random() * 300}ms`;
    container.appendChild(particula);
  }

  const toast = document.createElement('div');
  toast.className = 'celebracao-toast';
  toast.textContent = mensagem;
  document.body.appendChild(toast);

  setTimeout(function () {
    container.remove();
    toast.remove();
  }, 3200);
}

// ---------- GRÁFICOS (com tooltip) ----------
function renderizarGraficos() {
  const respostasVisiveis = obterRespostasFiltradas();
  const resumo = calcularResumo(respostasVisiveis);
  const total = resumo.total || 1;

  const dadosNotas = Array.from({ length: 10 }, (_, i) => {
    const nota = String(i + 1);
    const valor = resumo.porNota[nota] || 0;
    return {
      rotulo: nota,
      valor,
      textoExibido: mostrarPercentual ? `${Math.round((valor / total) * 100)}%` : valor,
    };
  });

  const containerNotas = document.getElementById('grafico-notas');
  if (tipoGraficoNotas === 'linha') {
    renderizarLinha(containerNotas, dadosNotas);
  } else {
    renderizarBarras(containerNotas, dadosNotas);
  }
  ativarTooltipGrafico(containerNotas);

  const dadosTipos = Object.entries(resumo.porTipo).map(([rotulo, valor], i) => ({
    rotulo,
    valor,
    cor: CORES_GRAFICO[i % CORES_GRAFICO.length],
    textoExibido: mostrarPercentual ? `${Math.round((valor / total) * 100)}%` : valor,
  }));

  const containerTipos = document.getElementById('grafico-tipos');
  if (tipoGraficoTipos === 'barras') {
    renderizarBarras(containerTipos, dadosTipos);
  } else {
    renderizarDonut(containerTipos, dadosTipos);
  }
  ativarTooltipGrafico(containerTipos);

  const legenda = document.getElementById('legenda-tipos');
  legenda.innerHTML = dadosTipos
    .map((d) => {
      const percentual = Math.round((d.valor / total) * 100);
      return `<li><span class="legenda-tipos__cor" style="background:${d.cor}"></span>${escaparHtml(d.rotulo)} — ${d.valor} (${percentual}%)</li>`;
    })
    .join('');
}

function ativarTooltipGrafico(container) {
  const tooltip = document.getElementById('tooltip-grafico');

  container.querySelectorAll('[data-rotulo]').forEach((elemento) => {
    elemento.addEventListener('mouseenter', function () {
      tooltip.textContent = `${elemento.dataset.rotulo}: ${elemento.dataset.valor}`;
      tooltip.hidden = false;
    });
    elemento.addEventListener('mousemove', function (evento) {
      tooltip.style.left = `${evento.clientX + 12}px`;
      tooltip.style.top = `${evento.clientY + 12}px`;
    });
    elemento.addEventListener('mouseleave', function () {
      tooltip.hidden = true;
    });
  });
}

// ---------- TABELA (paginação + seleção) ----------
function renderizarTabela() {
  const todasFiltradas = obterRespostasFiltradas();
  const totalPaginas = Math.max(Math.ceil(todasFiltradas.length / ITENS_POR_PAGINA), 1);
  paginaAtual = Math.min(paginaAtual, totalPaginas);

  const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
  const respostasPagina = todasFiltradas.slice(inicio, inicio + ITENS_POR_PAGINA);

  const corpo = document.getElementById('corpo-tabela');
  const estadoVazio = document.getElementById('estado-vazio');
  const paginacao = document.getElementById('paginacao');

  atualizarContadorFiltrados();

  if (todasFiltradas.length === 0) {
    corpo.innerHTML = '';
    estadoVazio.hidden = false;
    paginacao.hidden = true;

    const titulo = document.getElementById('estado-vazio-titulo');
    const texto = document.getElementById('estado-vazio-texto');
    if (respostasOriginais.length === 0) {
      titulo.textContent = 'Nenhuma resposta ainda';
      texto.textContent = 'Assim que alguém enviar o formulário, as respostas aparecem aqui.';
    } else {
      titulo.textContent = 'Nenhuma resposta encontrada';
      texto.textContent = 'Nenhum resultado bate com os filtros aplicados.';
    }

    atualizarBarraSelecao();
    return;
  }

  estadoVazio.hidden = true;
  paginacao.hidden = totalPaginas <= 1;
  document.getElementById('texto-pagina').textContent = `Página ${paginaAtual} de ${totalPaginas}`;
  document.getElementById('botao-pagina-anterior').disabled = paginaAtual <= 1;
  document.getElementById('botao-pagina-proxima').disabled = paginaAtual >= totalPaginas;

  corpo.innerHTML = respostasPagina
    .map((r) => {
      const id = String(r.id ?? '');
      const opiniao = r.opiniao || '';
      const opiniaoResumida = opiniao.length > 40 ? opiniao.slice(0, 40) + '…' : opiniao;
      const selecionada = idsSelecionados.has(id);
      const ehNova = !idsConhecidos.has(id);

      return `
        <tr data-id="${escaparAtributo(id)}" class="${selecionada ? 'linha-selecionada' : ''} ${ehNova ? 'linha-nova' : ''}">
          <td><input type="checkbox" class="checkbox-linha checkbox-personalizado" data-id="${escaparAtributo(id)}" ${selecionada ? 'checked' : ''} aria-label="Selecionar resposta"></td>
          <td class="celula-clicavel">${escaparHtml(r['nome-completo'])}</td>
          <td class="celula-clicavel">${formatarData(r.nascimento)}</td>
          <td class="celula-clicavel">${escaparHtml(r['tipo-participante'])}</td>
          <td class="celula-nota celula-clicavel">${escaparHtml(r.nota)}</td>
          <td class="celula-clicavel">${formatarDataHora(r['enviado-em'])}</td>
          <td class="celula-opiniao">
            ${
              opiniao
                ? `<button type="button" class="botao-ver-opiniao" data-opiniao="${escaparAtributo(opiniao)}">${escaparHtml(opiniaoResumida)}</button>`
                : '<span class="texto-vazio">—</span>'
            }
          </td>
          <td>
            <button type="button" class="botao-deletar" data-id="${escaparAtributo(id)}" aria-label="Excluir esta resposta">🗑</button>
          </td>
        </tr>
      `;
    })
    .join('');

  ligarEventosDaTabela(respostasPagina);
  atualizarBarraSelecao();

  // Depois de mostrar o destaque, essas respostas passam a ser "conhecidas" —
  // assim, só a próxima resposta genuinamente nova é destacada de novo.
  respostasPagina.forEach((r) => idsConhecidos.add(String(r.id)));
}

function ligarEventosDaTabela(respostasPagina) {
  document.querySelectorAll('.botao-deletar').forEach((botao) => {
    botao.addEventListener('click', function (evento) {
      evento.stopPropagation();
      confirmarExclusao([botao.dataset.id]);
    });
  });

  document.querySelectorAll('.botao-ver-opiniao').forEach((botao) => {
    botao.addEventListener('click', function (evento) {
      evento.stopPropagation();
      abrirPopup({
        tipo: 'info',
        titulo: 'Opinião completa',
        texto: botao.dataset.opiniao,
        textoBotao: 'Fechar',
        aoConfirmar: function () {},
      });
    });
  });

  document.querySelectorAll('.checkbox-linha').forEach((checkbox) => {
    checkbox.addEventListener('click', function (evento) {
      evento.stopPropagation();
    });
    checkbox.addEventListener('change', function () {
      const id = checkbox.dataset.id;
      if (checkbox.checked) idsSelecionados.add(id);
      else idsSelecionados.delete(id);
      renderizarTabela();
    });
  });

  document.querySelectorAll('#corpo-tabela tr[data-id]').forEach((linha) => {
    linha.addEventListener('click', function () {
      const resposta = respostasPagina.find((r) => String(r.id) === linha.dataset.id);
      if (resposta) abrirPainelDetalhe(resposta);
    });
  });
}

function atualizarContadorFiltrados() {
  const total = respostasOriginais.length;
  const filtradas = obterRespostasFiltradas().length;
  document.getElementById('contador-filtrados').textContent =
    filtradas === total ? `${total} respostas` : `Mostrando ${filtradas} de ${total}`;
}

function atualizarBarraSelecao() {
  const barra = document.getElementById('barra-selecao');
  const texto = document.getElementById('texto-selecao');

  if (idsSelecionados.size === 0) {
    barra.hidden = true;
    return;
  }

  barra.hidden = false;
  texto.textContent = `${idsSelecionados.size} selecionada${idsSelecionados.size > 1 ? 's' : ''}`;
}

// ---------- PAINEL LATERAL DE DETALHE ----------
function abrirPainelDetalhe(resposta) {
  const conteudo = document.getElementById('painel-detalhe-conteudo');

  const campos = [
    ['Nome completo', resposta['nome-completo']],
    ['Data de nascimento', formatarData(resposta.nascimento)],
    ['Tipo de participante', resposta['tipo-participante']],
    ['Nota', resposta.nota],
    ['Enviado em', formatarDataHora(resposta['enviado-em'], true)],
    ['Opinião', resposta.opiniao || '(não preenchida)'],
  ];

  conteudo.innerHTML = campos
    .map(
      ([rotulo, valor]) => `
        <div class="detalhe-campo">
          <p class="detalhe-campo__rotulo">${escaparHtml(rotulo)}</p>
          <p class="detalhe-campo__valor">${escaparHtml(valor)}</p>
        </div>
      `
    )
    .join('');

  document.getElementById('painel-detalhe-overlay').hidden = false;
}

function fecharPainelDetalhe() {
  document.getElementById('painel-detalhe-overlay').hidden = true;
}

// ---------- EXCLUSÃO COM DESFAZER ----------
function confirmarExclusao(ids) {
  const quantidade = ids.length;

  abrirPopup({
    tipo: 'erro',
    titulo: quantidade === 1 ? 'Excluir esta resposta?' : `Excluir ${quantidade} respostas?`,
    texto: 'Você poderá desfazer por alguns segundos depois de confirmar.',
    textoBotao: 'Excluir',
    aoConfirmar: function () {
      iniciarExclusaoComDesfazer(ids);
    },
  });
}

function iniciarExclusaoComDesfazer(ids) {
  ids.forEach((id) => {
    const linha = document.querySelector(`#corpo-tabela tr[data-id="${id}"]`);
    if (linha) linha.classList.add('linha-saindo');
    idsSelecionados.delete(id);
  });

  setTimeout(function () {
    const removidas = respostasOriginais.filter((r) => ids.includes(String(r.id)));
    respostasOriginais = respostasOriginais.filter((r) => !ids.includes(String(r.id)));
    renderizarTudo();

    const timeoutId = setTimeout(async function () {
      if (EH_AMBIENTE_LOCAL) {
        console.warn('[modo dev] Exclusão "real" simulada para', removidas.length, 'resposta(s).');
        return;
      }
      for (const resposta of removidas) {
        try {
          await deletarResposta(resposta.id);
        } catch (erro) {
          console.error('Falha ao excluir de verdade no backend:', erro);
        }
      }
    }, 5000);

    mostrarToastDesfazer(removidas.length, function desfazer() {
      clearTimeout(timeoutId);
      respostasOriginais = [...respostasOriginais, ...removidas];
      renderizarTudo();
    });
  }, 300);
}

function mostrarToastDesfazer(quantidade, aoDesfazer) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <span>${quantidade} resposta${quantidade > 1 ? 's' : ''} excluída${quantidade > 1 ? 's' : ''}.</span>
    <button type="button" class="toast__desfazer">Desfazer</button>
    <span class="toast__barra"></span>
  `;

  container.appendChild(toast);

  const remover = function () {
    toast.classList.add('toast--saindo');
    setTimeout(function () {
      toast.remove();
    }, 220);
  };

  toast.querySelector('.toast__desfazer').addEventListener('click', function () {
    aoDesfazer();
    remover();
  });

  setTimeout(remover, 5000);
}

// ---------- EXPORTAR CSV ----------
function exportarCSV() {
  const respostas = obterRespostasFiltradas();
  const cabecalho = ['Nome', 'Nascimento', 'Tipo', 'Nota', 'Enviado em', 'Opinião'];
  const linhas = respostas.map((r) => [
    r['nome-completo'],
    r.nascimento,
    r['tipo-participante'],
    r.nota,
    formatarDataHora(r['enviado-em'], true),
    (r.opiniao || '').replace(/\n/g, ' '),
  ]);

  const csv = [cabecalho, ...linhas]
    .map((linha) => linha.map((valor) => `"${String(valor ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'respostas.csv';
  link.click();
  URL.revokeObjectURL(url);
}

// ---------- UTILITÁRIOS ----------
function formatarData(dataISO) {
  if (!dataISO) return '—';
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(dataHoraISO, comSegundos) {
  if (!dataHoraISO) return '—';
  const data = new Date(dataHoraISO);
  if (isNaN(data.getTime())) return '—';

  const dataFormatada = data.toLocaleDateString('pt-BR');
  const horaFormatada = data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: comSegundos ? '2-digit' : undefined,
  });

  return `${dataFormatada} ${horaFormatada}`;
}

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}

function escaparAtributo(texto) {
  return String(texto ?? '').replace(/"/g, '&quot;');
}