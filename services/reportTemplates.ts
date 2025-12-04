import { FilterType, ImageSource, Kernel3x3 } from '../types';

interface ReportImages {
  original: string | null;
  processed: string | null;
  spectrum: string | null;
}

// Estilos CSS inline para equações e matrizes
const CSS_STYLES = `
  .math-fraction { display: inline-block; vertical-align: middle; text-align: center; margin: 0 4px; }
  .math-numerator { display: block; border-bottom: 1px solid #000; padding-bottom: 2px; }
  .math-denominator { display: block; padding-top: 2px; }
  .math-sqrt { border-top: 1px solid #000; padding-top: 1px; }
  .matrix-cell { 
    padding: 8px 12px; 
    border: 1px solid #94a3b8; 
    text-align: center; 
    color: #0f172a; 
    font-weight: bold; 
    font-family: 'Courier New', monospace;
  }
  .matrix-cell-zero { background-color: #f8fafc; color: #94a3b8; }
  .matrix-cell-val { background-color: #e0f2fe; color: #0369a1; }
`;

// Helper para renderizar matrizes com estilos explícitos
const renderMatrix = (rows: number[][]) => {
  const rowsHtml = rows.map(row => 
    `<tr>${row.map(val => {
      // Como os valores do LoG dinâmico podem ser floats, formatamos
      const displayVal = Number.isInteger(val) ? val : val.toFixed(1);
      const cellClass = val === 0 ? 'matrix-cell-zero' : 'matrix-cell-val';
      // Forçamos estilos inline para garantir impressão correta
      const bg = val === 0 ? '#f8fafc' : '#e0f2fe';
      const col = val === 0 ? '#94a3b8' : '#0369a1';
      return `<td class="matrix-cell" style="background-color: ${bg}; color: ${col}; border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 30px;">${displayVal}</td>`;
    }).join('')}</tr>`
  ).join('');
  
  return `
    <table style="border-collapse: separate; border-spacing: 2px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 4px;">
      ${rowsHtml}
    </table>
  `;
};

// Helper para frações HTML
const frac = (num: string, den: string) => `
  <span class="math-fraction">
    <span class="math-numerator">${num}</span>
    <span class="math-denominator">${den}</span>
  </span>
`;

const getFilterDetails = (filter: FilterType, customKernel?: Kernel3x3) => {
  switch (filter) {
    case FilterType.SOBEL_X:
      return {
        title: "Operador Sobel (Gradiente Horizontal)",
        kernel: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]],
        // Gx = df/dx approx Kx * A
        mathHTML: `G<sub>x</sub> = ${frac('&part;f', '&part;x')} &approx; K<sub>x</sub> &ast; A`,
        desc: "O filtro Sobel X aproxima a derivada parcial da imagem em relação a x. A coluna central de zeros remove o pixel atual da conta, calculando a diferença entre os vizinhos da direita e da esquerda."
      };
    case FilterType.SOBEL_Y:
      return {
        title: "Operador Sobel (Gradiente Vertical)",
        kernel: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]],
        // Gy = df/dy approx Ky * A
        mathHTML: `G<sub>y</sub> = ${frac('&part;f', '&part;y')} &approx; K<sub>y</sub> &ast; A`,
        desc: "O Sobel Y é o transposto do Sobel X. Ele calcula a diferença entre a linha inferior e a superior. Regiões onde a intensidade muda verticalmente geram altos valores."
      };
    case FilterType.PREWITT_MAG:
      return {
        title: "Operador Prewitt (Magnitude)",
        kernel: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]], 
        // G = sqrt(Gx^2 + Gy^2)
        mathHTML: `G = &radic;<span class="math-sqrt">G<sub>x</sub><sup>2</sup> + G<sub>y</sub><sup>2</sup></span>`,
        desc: "O operador Prewitt é similar ao Sobel, mas utiliza pesos uniformes (1) em vez de ponderação gaussiana (2)."
      };
    case FilterType.LAPLACIAN:
      return {
        title: "Laplaciano (Derivada de 2ª Ordem)",
        kernel: [[0, 1, 0], [1, -4, 1], [0, 1, 0]],
        // nabla^2 f = d^2f/dx^2 + ...
        mathHTML: `&nabla;<sup>2</sup>f = ${frac('&part;<sup>2</sup>f', '&part;x<sup>2</sup>')} + ${frac('&part;<sup>2</sup>f', '&part;y<sup>2</sup>')}`,
        desc: "O Laplaciano é um operador isotrópico. Diferente do gradiente (que detecta a rampa da borda), o Laplaciano detecta o cruzamento por zero (zero-crossing)."
      };
    case FilterType.LOG:
      return {
        title: customKernel?.name || "LoG (Laplacian of Gaussian)",
        // A matriz agora é dinâmica, usamos a passada se existir
        kernel: customKernel?.matrix || [],
        mathHTML: `LoG(x,y) = -${frac('1','&pi;&sigma;<sup>4</sup>')} [1 - ${frac('x<sup>2</sup>+y<sup>2</sup>','2&sigma;<sup>2</sup>')}] e<sup>-${frac('x<sup>2</sup>+y<sup>2</sup>','2&sigma;<sup>2</sup>')}</sup>`,
        desc: "O LoG combina a suavização Gaussiana (controlada por &sigma;) com o Laplaciano. Primeiro, o filtro suaviza a imagem para remover ruído (passa-baixas), e depois calcula a derivada de segunda ordem para encontrar bordas (passa-altas). O resultado são bordas mais limpas, fechadas e com menos falso-positivos causados por ruído pontual."
      };
    default: 
      return {
        title: "Magnitude do Gradiente (Sobel)",
        kernel: null, 
        mathHTML: `G = &radic;<span class="math-sqrt">G<sub>x</sub><sup>2</sup> + G<sub>y</sub><sup>2</sup></span>`,
        desc: "A magnitude do gradiente combina as respostas horizontal e vertical. É a métrica padrão para detecção de bordas, pois captura a força da variação independente da direção."
      };
  }
};

const getFrequencyText = (filter: FilterType) => {
    if (filter === FilterType.NONE) return "Espectro plano (Passa-tudo). Todas as frequências espaciais são preservadas.";
    
    if (filter === FilterType.LAPLACIAN) {
        return "O espectro do Laplaciano exibe um comportamento **Passa-Altas** parabólico. A magnitude da resposta em frequência aumenta quadraticamente com a distância da origem ($u=0, v=0$). O componente DC (centro) é zero (preto).";
    }

    if (filter === FilterType.LOG) {
        return "O espectro do LoG tem o formato de 'Chapéu Mexicano' invertido (Banda Passante). Ele atua como um filtro **Passa-Faixa**. As frequências muito altas (onde reside o ruído) são atenuadas pelo componente Gaussiano, e as frequências muito baixas (fundo constante) são eliminadas pelo Laplaciano. Isso isola a faixa de frequências onde residem as bordas estruturais, ignorando detalhes finos irrelevantes.";
    }
    
    if (filter.includes('X')) {
        return "O espectro revela um comportamento de **Filtro de Banda** direcional. No eixo horizontal ($u$), ele atua como Passa-Altas (derivada). No eixo vertical ($v$), ele atua como Passa-Baixas (média ponderada).";
    }

    if (filter.includes('Y')) {
        return "Dual ao filtro X, este espectro brilha nas regiões superior e inferior (altas frequências verticais). O eixo horizontal central é escuro.";
    }

    return "O espectro de magnitude combinada demonstra um comportamento **Passa-Altas Global**. A região central (DC e baixas frequências) é escura. As regiões periféricas do espectro são brilhantes.";
};

export const getStaticReport = (
  source: ImageSource, 
  filter: FilterType,
  images: ReportImages,
  customKernel?: Kernel3x3
): string => {
  const details = getFilterDetails(filter, customKernel);
  const freqText = getFrequencyText(filter);
  const date = new Date().toLocaleDateString('pt-BR');

  let analysisText = "";
  if (filter === FilterType.LOG) {
    analysisText = "A aplicação do LoG demonstra claramente o compromisso entre suavização e detecção. Diferente do Laplaciano puro, que reage a qualquer ruído de alta frequência criando uma imagem granulada, o LoG filtra esse ruído previamente. Observa-se que bordas principais são mantidas, enquanto texturas finas e ruídos pontuais são atenuados. Se o Sigma utilizado foi alto, nota-se perda de detalhes finos e alargamento das bordas (bordas mais grossas).";
  } else if (source === ImageSource.SYNTHETIC_RECT) {
      analysisText = "A imagem de entrada apresenta descontinuidades ideais (degraus) nas direções ortogonais. O filtro respondeu conforme a teoria: as bordas perpendiculares à direção do gradiente foram realçadas com intensidade máxima.";
  } else if (source === ImageSource.SYNTHETIC_CIRCLE) {
      analysisText = "Devido à curvatura constante, a normal da borda varre todos os ângulos de 0 a 360 graus. O resultado visual confirma a dependência direcional do filtro (se anisotrópico) ou a invariância (se isotrópico).";
  } else {
      analysisText = "A imagem complexa permite avaliar a robustez do filtro. Observa-se que texturas finas e ruídos de alta frequência também foram amplificados.";
  }

  return `
    <style>${CSS_STYLES}</style>
    <div style="font-family: 'Times New Roman', serif; color: #000; line-height: 1.5;">
      
      <!-- Cabeçalho Acadêmico -->
      <div style="text-align: center; margin-bottom: 2rem; border-bottom: 1px solid #000; padding-bottom: 1rem;">
        <h1 style="font-size: 1.5rem; font-weight: bold; margin: 0; font-family: Arial, sans-serif;">RELATÓRIO DE PROCESSAMENTO DIGITAL DE SINAIS</h1>
        <h2 style="font-size: 1.1rem; font-weight: normal; margin: 5px 0 0 0;">Tema 2.2: Reconhecimento de Padrões e Detecção de Bordas</h2>
        <p style="font-size: 0.9rem; margin-top: 5px; color: #444;">Data de Geracão: ${date}</p>
      </div>

      <!-- 1. Introdução -->
      <div style="margin-bottom: 2rem;">
        <h3 style="font-family: Arial, sans-serif; font-size: 1.1rem; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 10px; font-weight: bold;">1. FUNDAMENTAÇÃO TEÓRICA</h3>
        <p style="text-align: justify; margin-bottom: 1rem;">
          A detecção de bordas é uma etapa fundamental em sistemas de visão computacional, visando reduzir a quantidade de dados a serem processados e, ao mesmo tempo, preservar as informações estruturais sobre os limites dos objetos.
        </p>
        <p style="text-align: justify; margin-bottom: 1rem;">
          Neste experimento, aplicou-se o <strong>${details.title}</strong>. Matematicamente, bordas são modeladas como descontinuidades locais na função de intensidade da imagem $f(x,y)$.
        </p>
        
        <div style="display: flex; justify-content: space-around; align-items: center; margin: 1.5rem 0; background: #f8fafc; padding: 1.5rem; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="text-align: center;">
                <p style="font-weight: bold; font-size: 0.9rem; margin-bottom: 10px; font-family: Arial, sans-serif; color: #475569;">MODELO MATEMÁTICO</p>
                <div style="font-family: 'Times New Roman', serif; font-style: italic; font-size: 1.3rem;">
                  ${details.mathHTML}
                </div>
            </div>
            ${details.kernel && details.kernel.length > 0 ? `
            <div style="text-align: center;">
                <p style="font-weight: bold; font-size: 0.9rem; margin-bottom: 10px; font-family: Arial, sans-serif; color: #475569;">KERNEL DE CONVOLUÇÃO</p>
                ${renderMatrix(details.kernel)}
            </div>
            ` : ''}
        </div>
        <p style="text-align: justify; font-size: 0.95rem;">
          <em>Descrição do Operador:</em> ${details.desc}
        </p>
      </div>

      <!-- 2. Análise Espectral (FFT) -->
      <div style="margin-bottom: 2rem;">
        <h3 style="font-family: Arial, sans-serif; font-size: 1.1rem; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 10px; font-weight: bold;">2. ANÁLISE NO DOMÍNIO DA FREQUÊNCIA (FFT)</h3>
        
        <div style="display: flex; gap: 20px; margin-bottom: 1rem; align-items: center;">
             <div style="flex: 0 0 140px; text-align: center;">
                ${images.spectrum ? `<img src="${images.spectrum}" style="width: 128px; height: 128px; border: 1px solid #333; display: block; margin: 0 auto; background: #000;" />` : ''}
                <p style="font-size: 0.8rem; margin-top: 5px; color: #555;">Fig 1. Espectro de Energia |H(u,v)|<br>(Branco = Alto Ganho)</p>
             </div>
             <div style="flex: 1;">
                <p style="text-align: justify;">
                  A Figura 1 apresenta a magnitude da Transformada de Fourier 2D (DFT) do kernel aplicado. Pelo Teorema da Convolução, a filtragem no domínio espacial equivale à multiplicação no domínio da frequência.
                </p>
                <p style="text-align: justify; margin-top: 0.5rem;">
                  <strong>Análise do Espectro:</strong> ${freqText}
                </p>
             </div>
        </div>
      </div>

      <!-- 3. Resultados Experimentais -->
      <div style="margin-bottom: 2rem;">
        <h3 style="font-family: Arial, sans-serif; font-size: 1.1rem; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 10px; font-weight: bold;">3. RESULTADOS EXPERIMENTAIS</h3>
        <p style="margin-bottom: 1rem;">Sinal de entrada: <strong>${source}</strong>.</p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 1rem;">
          <tr>
            <td style="width: 48%; padding: 5px; text-align: center; vertical-align: top;">
               ${images.original ? `<img src="${images.original}" style="width: 100%; border: 1px solid #999;" />` : ''}
               <p style="font-size: 0.9rem; margin-top: 5px;"><strong>Fig 2.</strong> Imagem Original $f(x,y)$</p>
            </td>
            <td style="width: 4%; vertical-align: middle; text-align: center; font-size: 1.5rem;">&rarr;</td>
            <td style="width: 48%; padding: 5px; text-align: center; vertical-align: top;">
               ${images.processed ? `<img src="${images.processed}" style="width: 100%; border: 1px solid #999;" />` : ''}
               <p style="font-size: 0.9rem; margin-top: 5px;"><strong>Fig 3.</strong> Imagem Filtrada $g(x,y)$</p>
            </td>
          </tr>
        </table>

        <h4 style="font-size: 1rem; font-weight: bold; margin-bottom: 0.5rem; font-family: Arial, sans-serif;">Discussão dos Resultados</h4>
        <p style="text-align: justify;">
          ${analysisText}
        </p>
      </div>

      <!-- 4. Conclusão -->
      <div style="margin-bottom: 2rem; border-top: 1px solid #000; padding-top: 1rem;">
        <h3 style="font-family: Arial, sans-serif; font-size: 1.1rem; margin-bottom: 10px; font-weight: bold;">4. CONCLUSÃO</h3>
        <p style="text-align: justify;">
          O experimento validou a eficácia do filtro <strong>${filter}</strong> na extração de características de borda. A análise espectral confirmou a natureza passa-altas do operador, justificando matematicamente a eliminação de fundos contínuos e o realce de detalhes finos.
        </p>
      </div>
      
      <div style="font-size: 0.7rem; color: #999; text-align: right; margin-top: 2rem;">
        Gerado por DSP Edge Detective | Unifesspa PDS 2025.4
      </div>

    </div>
  `;
};