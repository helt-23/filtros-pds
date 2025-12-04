import { FilterType, Kernel3x3, NoiseType } from "../types";

// ==========================================
// Kernel Definitions
// ==========================================

export const KERNELS: Record<string, Kernel3x3> = {
  [FilterType.SOBEL_X]: {
    name: "Sobel X",
    matrix: [
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1],
    ],
    description: "Detecta bordas verticais com suavização vertical.",
  },
  [FilterType.SOBEL_Y]: {
    name: "Sobel Y",
    matrix: [
      [-1, -2, -1],
      [0, 0, 0],
      [1, 2, 1],
    ],
    description: "Detecta bordas horizontais com suavização horizontal.",
  },
  [FilterType.PREWITT_X]: {
    name: "Prewitt X",
    matrix: [
      [-1, 0, 1],
      [-1, 0, 1],
      [-1, 0, 1],
    ],
    description: "Detecta bordas verticais sem suavização extra.",
  },
  [FilterType.PREWITT_Y]: {
    name: "Prewitt Y",
    matrix: [
      [-1, -1, -1],
      [0, 0, 0],
      [1, 1, 1],
    ],
    description: "Detecta bordas horizontais sem suavização extra.",
  },
  [FilterType.LAPLACIAN]: {
    name: "Laplacian",
    matrix: [
      [0, 1, 0],
      [1, -4, 1],
      [0, 1, 0],
    ],
    description: "Filtro de derivada segunda. Sensível a ruído.",
  },
};

// ==========================================
// Dynamic Kernel Generation (LoG)
// ==========================================

export const generateLoGKernel = (sigma: number): Kernel3x3 => {
  // Tamanho proporcional ao sigma (3σ cobre 99% da Gaussiana)
  const size = Math.max(3, Math.ceil(sigma * 3) * 2 + 1);
  const center = Math.floor(size / 2);

  const matrix: number[][] = Array(size)
    .fill(0)
    .map(() => Array(size).fill(0));

  let sum = 0;
  let maxAbs = 0;
  const sigma2 = sigma * sigma;
  const sigma4 = sigma2 * sigma2;

  // Fórmula do LoG: LoG(x,y) = -1/(πσ^4) * (1 - (x²+y²)/(2σ²)) * exp(-(x²+y²)/(2σ²))
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const r2 = dx * dx + dy * dy;

      // Termo exponencial (Gaussiana)
      const expTerm = Math.exp(-r2 / (2 * sigma2));

      // Termo polinomial (1 - r²/(2σ²))
      const polyTerm = 1 - r2 / (2 * sigma2);

      // Valor LoG completo
      const value = -(1 / (Math.PI * sigma4)) * polyTerm * expTerm;

      matrix[y][x] = value;
      sum += value;
      maxAbs = Math.max(maxAbs, Math.abs(value));
    }
  }

  // Normalização importante: garantimos que a intensidade DIMINUA com sigma aumentado
  // Quanto maior o sigma, menor a resposta das bordas (por causa da suavização)
  const scaleFactor = 1.0 / (sigma * 2); // Fator inversamente proporcional ao sigma
  let scaledSum = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Ajusta o valor para garantir soma zero
      matrix[y][x] = (matrix[y][x] - sum / (size * size)) * scaleFactor;
      scaledSum += matrix[y][x];
    }
  }

  // Arredonda para 3 casas decimais
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      matrix[y][x] = Math.round(matrix[y][x] * 1000) / 1000;
    }
  }

  return {
    name: `LoG (σ=${sigma.toFixed(1)})`,
    matrix,
    description: `Laplacian of Gaussian. Sigma=${sigma.toFixed(
      1
    )}. Kernel ${size}x${size}. Soma ≈ ${scaledSum.toFixed(3)}`,
  };
};

// ==========================================
// Image Generation
// ==========================================

export const drawSyntheticImage = (
  ctx: CanvasRenderingContext2D,
  type: string,
  width: number,
  height: number
) => {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 4;

  if (type.includes("Retângulo") || type.includes("Combinado")) {
    ctx.fillRect(50, 50, 150, 150);
  }
  if (type.includes("Círculo") || type.includes("Combinado")) {
    ctx.beginPath();
    ctx.arc(350, 150, 80, 0, 2 * Math.PI);
    ctx.fill();
  }
  if (type.includes("Combinado")) {
    ctx.beginPath();
    ctx.moveTo(50, 300);
    ctx.lineTo(450, 450);
    ctx.stroke();
  }
};

// ==========================================
// Noise Generation - MUITO REDUZIDO
// ==========================================

export const applyNoise = (
  imageData: ImageData,
  type: NoiseType
): ImageData => {
  if (type === NoiseType.NONE) return imageData;

  const width = imageData.width;
  const height = imageData.height;
  const output = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height
  );
  const data = output.data;
  const len = data.length;

  if (type === NoiseType.GAUSSIAN) {
    // Ruído MUITO suave para análise clara
    const sigma = 8; // Muito reduzido

    for (let i = 0; i < len; i += 4) {
      // Gera ruído gaussiano mais suave
      let u1, u2;
      do {
        u1 = Math.random();
        u2 = Math.random();
      } while (u1 <= 0);

      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      const noise = z0 * sigma;

      // Aplica ruído suave
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
  } else if (type === NoiseType.SALT_PEPPER) {
    // Ruído muito sutil
    const amount = 0.01; // Apenas 1%

    for (let i = 0; i < len; i += 4) {
      if (Math.random() < amount) {
        const val = Math.random() < 0.5 ? 0 : 255;
        data[i] = data[i + 1] = data[i + 2] = val;
      }
    }
  }

  return output;
};

// ==========================================
// Convolution Logic - CORRIGIDA COM NORMALIZAÇÃO ADEQUADA
// ==========================================

export const applyConvolution = (
  src: ImageData,
  kernelMatrix: number[][],
  threshold: number = 0
): ImageData => {
  const width = src.width;
  const height = src.height;
  const output = new ImageData(width, height);
  const srcData = src.data;
  const dstData = output.data;

  const kRows = kernelMatrix.length;
  const kCols = kernelMatrix[0].length;
  const kCenterX = Math.floor(kCols / 2);
  const kCenterY = Math.floor(kRows / 2);

  // Calcula propriedades do kernel
  let kernelSum = 0;
  let positiveSum = 0;
  let kernelL2Sum = 0;

  for (let r of kernelMatrix) {
    for (let v of r) {
      kernelSum += v;
      if (v > 0) positiveSum += v;
      kernelL2Sum += v * v;
    }
  }

  // Determina tipo de filtro
  const isHighPass = Math.abs(kernelSum) < 0.001; // Filtro de borda
  const isGaussian = kernelSum > 0.999 && kernelSum < 1.001; // Filtro gaussiano

  // Fatores de normalização específicos por tipo
  let normalizationFactor = 1.0;

  if (isHighPass) {
    // Normalização por energia (L2) do kernel para comparação justa entre operadores
    const kernelL2 = Math.sqrt(Math.max(1e-9, kernelL2Sum));
    normalizationFactor = kernelL2;
  } else if (isGaussian) {
    // Para Gaussian: não precisa de normalização extra
    normalizationFactor = 1.0;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let graySum = 0;

      for (let ky = 0; ky < kRows; ky++) {
        for (let kx = 0; kx < kCols; kx++) {
          const px = x + (kx - kCenterX);
          const py = y + (ky - kCenterY);

          if (px >= 0 && px < width && py >= 0 && py < height) {
            const offset = (py * width + px) * 4;
            const weight = kernelMatrix[ky][kx];
            const r = srcData[offset];
            const g = srcData[offset + 1];
            const b = srcData[offset + 2];
            const yLum = 0.299 * r + 0.587 * g + 0.114 * b;
            graySum += yLum * weight;
          }
        }
      }

      // Para filtros de borda, usa magnitude; para Gaussian, usa média
      let result: number;
      if (isHighPass) {
        const magnitude = Math.abs(graySum);
        result = Math.min(255, magnitude / normalizationFactor);
      } else {
        result = Math.min(255, Math.max(0, graySum));
      }

      // Aplica threshold
      if (result < threshold) {
        result = 0;
      }

      const dstOffset = (y * width + x) * 4;
      dstData[dstOffset] = result;
      dstData[dstOffset + 1] = result;
      dstData[dstOffset + 2] = result;
      dstData[dstOffset + 3] = 255;
    }
  }
  return output;
};

export const applyLoGConvolution = (
  src: ImageData,
  sigma: number,
  threshold: number = 0
): ImageData => {
  const logKernel = generateLoGKernel(sigma);
  const convolved = applyConvolution(src, logKernel.matrix, 0);

  // Auto-contraste: normaliza para 0-255 usando min/max
  let minVal = 255;
  let maxVal = 0;
  for (let i = 0; i < convolved.data.length; i += 4) {
    const v = convolved.data[i];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }
  const range = Math.max(1, maxVal - minVal);
  const rescaled = new ImageData(convolved.width, convolved.height);
  for (let i = 0; i < convolved.data.length; i += 4) {
    const v = convolved.data[i];
    const n = Math.min(255, Math.max(0, ((v - minVal) * 255) / range));
    rescaled.data[i] = n;
    rescaled.data[i + 1] = n;
    rescaled.data[i + 2] = n;
    rescaled.data[i + 3] = 255;
  }

  // Limiar: usa slider se >0, senão percentil (90%)
  const t =
    threshold > 0 ? threshold : computePercentileThreshold(rescaled, 90);
  const output = thresholdImage(rescaled, t);
  return output;
};

export const combineMagnitude = (
  imgA: ImageData,
  imgB: ImageData,
  threshold: number = 0
): ImageData => {
  const width = imgA.width;
  const height = imgA.height;
  const output = new ImageData(width, height);

  for (let i = 0; i < output.data.length; i += 4) {
    const valA = imgA.data[i];
    const valB = imgB.data[i];

    // Magnitude do gradiente: sqrt(Gx² + Gy²)
    let mag = Math.sqrt(valA * valA + valB * valB);

    // Normalização específica para Sobel/Prewitt
    mag = mag / 4.0; // Fator para visualização adequada

    if (mag < threshold) mag = 0;

    mag = Math.min(255, mag);

    output.data[i] = mag;
    output.data[i + 1] = mag;
    output.data[i + 2] = mag;
    output.data[i + 3] = 255;
  }
  return output;
};

export const generateGaussianKernel = (sigma: number): Kernel3x3 => {
  const size = Math.max(3, Math.ceil(sigma * 3) * 2 + 1);
  const actualSize = size % 2 === 0 ? size + 1 : size;
  const center = Math.floor(actualSize / 2);

  const matrix: number[][] = Array(actualSize)
    .fill(0)
    .map(() => Array(actualSize).fill(0));
  let sum = 0;

  for (let y = 0; y < actualSize; y++) {
    for (let x = 0; x < actualSize; x++) {
      const dx = x - center;
      const dy = y - center;
      const r2 = dx * dx + dy * dy;
      const value = Math.exp(-r2 / (2 * sigma * sigma));
      matrix[y][x] = value;
      sum += value;
    }
  }

  // Normaliza para soma = 1
  for (let y = 0; y < actualSize; y++) {
    for (let x = 0; x < actualSize; x++) {
      matrix[y][x] = matrix[y][x] / sum;
    }
  }

  return {
    name: `Gaussian (σ=${sigma.toFixed(1)})`,
    matrix,
    description: `Filtro passa-baixa para suavização. Sigma=${sigma.toFixed(
      1
    )} controla intensidade.`,
  };
};

// ==========================================
// Frequency Analysis (Kernel FFT)
// ==========================================

export const computeKernelSpectrum = (
  kernel: number[][],
  size: number = 128
): number[][] => {
  const spectrum: number[][] = Array(size)
    .fill(0)
    .map(() => Array(size).fill(0));
  const cx = size / 2;
  const cy = size / 2;
  const kRows = kernel.length;
  const kCols = kernel[0].length;
  const kCenterRow = Math.floor(kRows / 2);
  const kCenterCol = Math.floor(kCols / 2);
  let maxMag = 0;
  const twoPiOverSize = (2 * Math.PI) / size;

  for (let u = 0; u < size; u++) {
    for (let v = 0; v < size; v++) {
      let real = 0;
      let imag = 0;
      for (let m = 0; m < kRows; m++) {
        for (let n = 0; n < kCols; n++) {
          const weight = kernel[m][n];
          if (weight === 0) continue;
          const mShift = m - kCenterRow;
          const nShift = n - kCenterCol;
          const w_u = (u - cx) * twoPiOverSize;
          const w_v = (v - cy) * twoPiOverSize;
          const angle = -1 * (w_u * nShift + w_v * mShift);
          real += weight * Math.cos(angle);
          imag += weight * Math.sin(angle);
        }
      }
      const magnitude = Math.sqrt(real * real + imag * imag);
      spectrum[u][v] = magnitude;
      if (magnitude > maxMag) maxMag = magnitude;
    }
  }

  // Normalização para 0-1
  if (maxMag > 0) {
    for (let u = 0; u < size; u++) {
      for (let v = 0; v < size; v++) {
        spectrum[u][v] /= maxMag;
      }
    }
  }

  return spectrum;
};

export const getLineProfile = (imageData: ImageData, rowIndex: number) => {
  const width = imageData.width;
  const data = [];
  const offsetStart = rowIndex * width * 4;
  for (let x = 0; x < width; x += 2) {
    const intensity = imageData.data[offsetStart + x * 4];
    data.push({ x, intensity });
  }
  return data;
};

export const computeTenengrad = (imageData: ImageData): number => {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = imageData.data[i];
    sum += v * v;
    count++;
  }
  return count > 0 ? sum / count : 0;
};

export const computeEdgeDensity = (
  imageData: ImageData,
  threshold: number
): number => {
  let edge = 0;
  let total = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = imageData.data[i];
    if (v > threshold) edge++;
    total++;
  }
  return total > 0 ? edge / total : 0;
};

export const computeNonZeroFraction = (imageData: ImageData): number => {
  let nz = 0;
  let total = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = imageData.data[i];
    if (v > 0) nz++;
    total++;
  }
  return total > 0 ? nz / total : 0;
};

export const computeCNR = (imageData: ImageData, threshold: number): number => {
  let sumE = 0,
    sumE2 = 0,
    nE = 0;
  let sumB = 0,
    sumB2 = 0,
    nB = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = imageData.data[i];
    if (v > threshold) {
      sumE += v;
      sumE2 += v * v;
      nE++;
    } else {
      sumB += v;
      sumB2 += v * v;
      nB++;
    }
  }
  if (nE === 0 || nB === 0) return 0;
  const muE = sumE / nE;
  const muB = sumB / nB;
  const varE = Math.max(0, sumE2 / nE - muE * muE);
  const varB = Math.max(0, sumB2 / nB - muB * muB);
  const denom = Math.sqrt(varE + varB);
  return denom > 0 ? Math.abs(muE - muB) / denom : 0;
};

export const computeBackgroundSNR = (
  imageData: ImageData,
  threshold: number
): number => {
  let sum = 0,
    sum2 = 0,
    n = 0;
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = imageData.data[i];
    if (v <= threshold) {
      sum += v;
      sum2 += v * v;
      n++;
    }
  }
  if (n === 0) return 0;
  const mu = sum / n;
  const varBg = Math.max(0, sum2 / n - mu * mu);
  const sigma = Math.sqrt(varBg);
  return sigma > 0 ? mu / sigma : 0;
};

export const computeLineMetrics = (
  profile: { x: number; intensity: number }[]
) => {
  if (!profile.length) return { peak: 0, fwhm: 0, peakToBg: 0 };
  let peak = 0;
  let peakIdx = 0;
  for (let i = 0; i < profile.length; i++) {
    const v = profile[i].intensity;
    if (v > peak) {
      peak = v;
      peakIdx = i;
    }
  }
  const half = peak / 2;
  let left = peakIdx,
    right = peakIdx;
  while (left > 0 && profile[left].intensity > half) left--;
  while (right < profile.length - 1 && profile[right].intensity > half) right++;
  const fwhm = Math.max(0, profile[right].x - profile[left].x);
  const sorted = [...profile].map((p) => p.intensity).sort((a, b) => a - b);
  const q = Math.max(1, Math.floor(sorted.length * 0.25));
  const bgMean = sorted.slice(0, q).reduce((a, b) => a + b, 0) / q;
  const peakToBg = bgMean > 0 ? peak / bgMean : 0;
  return { peak, fwhm, peakToBg };
};

export const computePercentileThreshold = (
  imageData: ImageData,
  percentile: number
): number => {
  const p = Math.min(100, Math.max(0, percentile));
  const values: number[] = [];
  for (let i = 0; i < imageData.data.length; i += 4) {
    values.push(imageData.data[i]);
  }
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (values.length - 1));
  return values[idx];
};

export const thresholdImage = (imageData: ImageData, t: number): ImageData => {
  const output = new ImageData(imageData.width, imageData.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    let v = imageData.data[i];
    if (v < t) v = 0;
    output.data[i] = v;
    output.data[i + 1] = v;
    output.data[i + 2] = v;
    output.data[i + 3] = 255;
  }
  return output;
};
