export enum FilterType {
  NONE = 'Original',
  SOBEL_X = 'Sobel X',
  SOBEL_Y = 'Sobel Y',
  SOBEL_MAG = 'Sobel Magnitude',
  PREWITT_X = 'Prewitt X',
  PREWITT_Y = 'Prewitt Y',
  PREWITT_MAG = 'Prewitt Magnitude',
  LAPLACIAN = 'Laplacian',
  LOG = 'LoG (Laplacian of Gaussian)',
}

export enum ImageSource {
  UPLOAD = 'Upload',
  SYNTHETIC_COMBINED = 'Sintético (Combinado)',
  SYNTHETIC_RECT = 'Sintético (Retângulo)',
  SYNTHETIC_CIRCLE = 'Sintético (Círculo)',
}

export enum NoiseType {
  NONE = 'Sem Ruído',
  GAUSSIAN = 'Gaussiano (AWGN)',
  SALT_PEPPER = 'Salt & Pepper',
}

export interface Kernel3x3 {
  name: string;
  matrix: number[][]; // Pode ser 3x3, 5x5, etc.
  description: string;
}

export interface ProcessingResult {
  imageData: ImageData | null;
  histogram: { value: number; count: number }[];
  profile: { x: number; intensity: number }[];
}