// components/grafico.js
// Gráficos leves em SVG puro — sem biblioteca externa. Todos entram com
// uma animação de "desenho" (CSS puro, via classes + @keyframes no dashboard.css).

/**
 * Gráfico de barras verticais, com entrada animada (cresce de baixo pra cima).
 * @param {HTMLElement} container
 * @param {Array<{rotulo: string, valor: number, textoExibido?: string}>} dados
 */
export function renderizarBarras(container, dados) {
  const largura = 320;
  const altura = 160;
  const base = altura - 20;
  const maxValor = Math.max(...dados.map((d) => d.valor), 1);
  const espacoBarra = largura / dados.length;

  const barras = dados
    .map((d, i) => {
      const alturaBarra = Math.max((d.valor / maxValor) * (altura - 32), 0);
      const x = i * espacoBarra + espacoBarra * 0.2;
      const larguraBarra = espacoBarra * 0.6;
      const y = base - alturaBarra;
      const texto = d.textoExibido ?? d.valor;

      return `
        <g class="barra-svg" style="transform-origin:${x + larguraBarra / 2}px ${base}px; animation-delay:${i * 35}ms;"
           data-rotulo="${d.rotulo}" data-valor="${texto}">
          <rect x="${x}" y="${y}" width="${larguraBarra}" height="${alturaBarra}" rx="3" fill="var(--color-primary)" />
        </g>
        <text x="${x + larguraBarra / 2}" y="${altura - 4}" text-anchor="middle"
              font-size="10" fill="var(--color-text-muted)">${d.rotulo}</text>
        ${d.valor > 0 ? `<text x="${x + larguraBarra / 2}" y="${y - 5}" text-anchor="middle"
              font-size="10" fill="var(--color-text-secondary)">${texto}</text>` : ''}
      `;
    })
    .join('');

  container.innerHTML = `<svg viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}" role="img" aria-label="Gráfico de barras">${barras}</svg>`;
}

/**
 * Gráfico de linha (útil pra ver tendência ao longo de categorias ordenadas, ex: notas 1→10).
 * @param {HTMLElement} container
 * @param {Array<{rotulo: string, valor: number, textoExibido?: string}>} dados
 */
export function renderizarLinha(container, dados) {
  const largura = 320;
  const altura = 160;
  const base = altura - 20;
  const maxValor = Math.max(...dados.map((d) => d.valor), 1);
  const passoX = largura / Math.max(dados.length - 1, 1);

  const pontos = dados.map((d, i) => {
    const x = i * passoX;
    const y = base - (d.valor / maxValor) * (altura - 36);
    return { x, y, ...d };
  });

  const linha = pontos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const marcadores = pontos
    .map(
      (p, i) => `
        <circle class="ponto-linha-svg" cx="${p.x}" cy="${p.y}" r="4" fill="var(--color-primary)" style="animation-delay:${i * 35 + 400}ms;"
          data-rotulo="${p.rotulo}" data-valor="${p.textoExibido ?? p.valor}" />
        <text x="${p.x}" y="${altura - 4}" text-anchor="middle" font-size="10" fill="var(--color-text-muted)">${p.rotulo}</text>
      `
    )
    .join('');

  const comprimentoAproximado = largura * 1.4;

  container.innerHTML = `<svg viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}" role="img" aria-label="Gráfico de linha">
    <polyline class="linha-svg" points="${linha}" fill="none" stroke="var(--color-primary)" stroke-width="2"
      stroke-dasharray="${comprimentoAproximado}" stroke-dashoffset="${comprimentoAproximado}" />
    ${marcadores}
  </svg>`;
}

/**
 * Gráfico de rosca (donut), com fatias entrando em sequência.
 * @param {HTMLElement} container
 * @param {Array<{rotulo: string, valor: number, cor: string}>} dados
 */
export function renderizarDonut(container, dados) {
  const tamanho = 160;
  const raio = tamanho / 2;
  const raioInterno = raio * 0.6;
  const total = dados.reduce((soma, d) => soma + d.valor, 0) || 1;

  if (dados.length === 0 || total === 0) {
    container.innerHTML = `<svg viewBox="0 0 ${tamanho} ${tamanho}" width="${tamanho}" height="${tamanho}">
      <circle cx="${raio}" cy="${raio}" r="${raioInterno + (raio - raioInterno) / 2}"
        fill="none" stroke="var(--color-border)" stroke-width="${raio - raioInterno}" />
    </svg>`;
    return;
  }

  let anguloAtual = -90;
  const fatias = dados
    .map((d, i) => {
      const angulo = (d.valor / total) * 360;
      const caminho = descreverFatia(raio, raio, raio, raioInterno, anguloAtual, anguloAtual + angulo);
      anguloAtual += angulo;
      return `<path class="fatia-svg" d="${caminho}" fill="${d.cor}"
        style="transform-origin:${raio}px ${raio}px; animation-delay:${i * 70}ms;"
        data-rotulo="${d.rotulo}" data-valor="${d.textoExibido ?? d.valor}" />`;
    })
    .join('');

  container.innerHTML = `<svg viewBox="0 0 ${tamanho} ${tamanho}" width="${tamanho}" height="${tamanho}" role="img" aria-label="Gráfico de proporção por tipo de participante">${fatias}</svg>`;
}

/**
 * Sparkline: mini-gráfico de linha sem eixos, pra usar dentro de um KPI.
 * @param {HTMLElement} container
 * @param {Array<number>} valores
 */
export function renderizarSparkline(container, valores) {
  if (!valores || valores.length < 2) {
    container.innerHTML = '';
    return;
  }

  const largura = 100;
  const altura = 28;
  const max = Math.max(...valores, 1);
  const min = Math.min(...valores, 0);
  const amplitude = max - min || 1;
  const passoX = largura / (valores.length - 1);

  const pontos = valores
    .map((v, i) => {
      const x = i * passoX;
      const y = altura - ((v - min) / amplitude) * (altura - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  container.innerHTML = `<svg viewBox="0 0 ${largura} ${altura}" width="100%" height="${altura}" preserveAspectRatio="none">
    <polyline class="sparkline-svg" points="${pontos}" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}

// ---------- MATEMÁTICA INTERNA ----------
function polarParaCartesiano(cx, cy, r, anguloGraus) {
  const anguloRad = (anguloGraus * Math.PI) / 180;
  return { x: cx + r * Math.cos(anguloRad), y: cy + r * Math.sin(anguloRad) };
}

function descreverFatia(cx, cy, rExterno, rInterno, anguloInicio, anguloFim) {
  const p1 = polarParaCartesiano(cx, cy, rExterno, anguloFim);
  const p2 = polarParaCartesiano(cx, cy, rExterno, anguloInicio);
  const p3 = polarParaCartesiano(cx, cy, rInterno, anguloInicio);
  const p4 = polarParaCartesiano(cx, cy, rInterno, anguloFim);
  const grandeArco = anguloFim - anguloInicio <= 180 ? '0' : '1';

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rExterno} ${rExterno} 0 ${grandeArco} 0 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInterno} ${rInterno} 0 ${grandeArco} 1 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}