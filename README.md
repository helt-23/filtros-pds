<div align="center">
  <h1>PDS Edge Detective</h1>
  <p>Laboratório interativo de Detecção de Bordas (Tema 2.2 – PDS)</p>
</div>

## Visão Geral

Aplicação web educacional que demonstra, de forma prática e visual, técnicas clássicas de detecção de bordas em imagens no contexto de Processamento Digital de Sinais (PDS). Permite:

- Selecionar fontes sintéticas ou enviar uma imagem.
- Aplicar filtros de borda: `Sobel`, `Prewitt`, `Laplacian` e `LoG (Laplacian of Gaussian)`.
- Controlar parâmetros como `σ (sigma)` do LoG, limiar global e pré-suavização Gaussiana.
- Visualizar a resposta ao impulso do kernel, o espectro de frequência 2D `|H(u,v)|` e o perfil de intensidade do sinal.
- Gerar relatório técnico em Markdown/PDF (padrão) ou via IA Gemini quando a imagem é de upload.

## Tecnologias Utilizadas

- `React 19` e `TypeScript 5`: construção da interface e tipagem.
- `Vite 6`: bundler e servidor de desenvolvimento.
- `TailwindCSS` via CDN: utilitários de estilo diretamente em `index.html`.
- `Lucide React`: ícones UI.
- `Recharts`: gráficos para perfil de intensidade.
- `@google/genai`: integração com o modelo Gemini para geração de relatórios quando aplicável.

## Estrutura do Projeto

- `App.tsx`: orquestra o fluxo do laboratório, estados, parâmetros e renderização das visualizações.
- `components/AnalysisCharts.tsx`: componentes para resposta ao impulso, espectro de frequência e perfil de intensidade.
- `services/dspService.ts`: lógica de PDS no domínio espacial.
  - Kernels clássicos (`Sobel`, `Prewitt`, `Laplacian`).
  - `generateLoGKernel(σ)`: kernel dinâmico do LoG com normalização.
  - `generateGaussianKernel(σ)`: kernel Gaussiano normalizado (soma = 1).
  - `applyConvolution(...)`: convolução com normalizações específicas (passa‑alta, Gaussiano) e limiar.
  - `applyLoGConvolution(...)`: ganho ajustado por `σ` para LoG.
  - `combineMagnitude(...)`: magnitude do gradiente `√(Gx²+Gy²)` para Sobel/Prewitt.
  - `computeKernelSpectrum(...)`: espectro 2D do kernel (análise em frequência para fins didáticos).
  - `applyNoise(...)`: ruído Gaussiano suave e Salt & Pepper.
- `services/reportTemplates.ts`: gera relatório técnico estático em HTML/Markdown com figuras (original, filtrada, espectro) e explicação.
- `services/geminiService.ts`: gera relatório via Gemini para imagens enviadas por upload (`@google/genai`).
- `types.ts`: enums e tipos (`FilterType`, `ImageSource`, `NoiseType`, `Kernel3x3`).
- `index.tsx` e `index.html`: bootstrap da aplicação; `TailwindCSS` e `importmap` CDN.
- `vite.config.ts`: alias, porta, e mapeamento de `process.env.GEMINI_API_KEY`/`process.env.API_KEY` para uso no cliente.

## Funcionalidades

- `Fontes de imagem`:
  - Sintéticas: Formas combinadas, círculo e retângulo (geradas em canvas).
  - Upload: JPG/PNG via `FileReader`.
- `Ruído`: Gaussiano (AWGN) suave e Salt & Pepper (leve), para avaliação de robustez.
- `Filtros de borda`:
  - `Sobel` e `Prewitt`: gradiente; opção de combinar magnitude `√(Gx²+Gy²)`.
  - `Laplacian`: derivada de 2ª ordem, sensível a ruído.
  - `LoG`: Gaussiano + Laplaciano, ajustável por `σ` (trade‑off ruído/detalhe).
- `Parâmetros`:
  - `σ (sigma)` do LoG com kernel de tamanho adequado (`≈ 3σ` por lado, ímpar).
  - `Limiar global` para suprimir bordas fracas.
  - `Pré‑suavização` Gaussiana opcional (para filtros não‑LoG).
- `Análises`:
  - Resposta ao impulso do kernel (matriz).
  - Espectro 2D `|H(u,v)|` (educacional, normalizado).
  - Perfil de intensidade de linha (Recharts).
- `Relatórios`:
  - Padrão (sintéticos): HTML com seções teóricas, espectro e discussão.
  - IA (upload): Markdown gerado via Gemini (`gemini-2.5-flash`).

## Execução Local

Pré‑requisitos: `Node.js` e `npm`.

1. Instale as dependências:

   `npm install`

2. Crie `.env.local` (ou `.env`) na raiz de `filtros-pds/` e defina:

   `GEMINI_API_KEY=SEU_TOKEN_DA_GEMINI`

   O `vite.config.ts` expõe `process.env.API_KEY` e `process.env.GEMINI_API_KEY` ao cliente, e `geminiService.ts` usa `process.env.API_KEY`.

3. Rode em desenvolvimento:

   `npm run dev`

   A aplicação inicia em `http://localhost:3000`.

4. Build e preview:

   `npm run build`

   `npm run preview`

## Observações de Ambiente

- `TailwindCSS` é carregado via CDN em `index.html`. Não há configuração local de Tailwind no build.
- O `importmap` aponta para CDNs dos pacotes, mas as dependências também estão listadas em `package.json` para uso local.
- Não versionar sua chave de API. Use `.env.local` e mantenha fora do controle de versão.

## Fluxo de Processamento (Resumo)

1. Desenho/entrada da imagem em `canvas` (`512×512`).
2. (Opcional) Aplicação de ruído leve para testes.
3. (Opcional) Pré‑suavização Gaussiana (`generateGaussianKernel` + `applyConvolution`).
4. Filtro principal (Sobel/Prewitt/Laplacian/LoG).
5. Limiar global e normalizações para visualização.
6. Geração de figuras e relatório.

## Geração de Relatórios

- Aba “Relatório Técnico” permite salvar em PDF (`window.print`).
- Para imagens de upload, a análise pode ser redigida pela IA Gemini; certifique‑se de ter `GEMINI_API_KEY` definido.

## Estrutura de Pastas (resumo)

```
filtros-pds/
├─ components/
│  └─ AnalysisCharts.tsx
├─ services/
│  ├─ dspService.ts
│  ├─ geminiService.ts
│  └─ reportTemplates.ts
├─ App.tsx
├─ index.html
├─ index.tsx
├─ types.ts
├─ vite.config.ts
├─ tsconfig.json
├─ package.json
└─ README.md
```

## Licença e Créditos

Projeto acadêmico para a disciplina de PDS (Unifesspa, 2025.4). Uso educacional.
