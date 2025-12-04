import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FilterType, 
  ImageSource, 
  Kernel3x3, 
  NoiseType
} from './types';
import { 
  KERNELS, 
  drawSyntheticImage, 
  applyConvolution, 
  combineMagnitude, 
  applyNoise,
  generateLoGKernel,
  applyLoGConvolution,
  generateGaussianKernel
} from './services/dspService';
import { generateDSPReport } from './services/geminiService';
import { getStaticReport } from './services/reportTemplates';
import { ImpulseResponseView, FrequencyResponseView } from './components/AnalysisCharts';
import { 
  Activity, 
  Upload, 
  FileText, 
  Cpu, 
  Settings2, 
  Image as ImageIcon,
  Download,
  RotateCcw,
  Zap,
  Waves,
  Sliders,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Info,
  HelpCircle,
  Lightbulb
} from 'lucide-react';


const App: React.FC = () => {
  // ==========================================
  // State Management
  // ==========================================
  const [activeTab, setActiveTab] = useState<'experiment' | 'report'>('experiment');
  
  // Source & Filter Configuration
  const [selectedSource, setSelectedSource] = useState<ImageSource>(ImageSource.SYNTHETIC_COMBINED);
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>(FilterType.NONE);
  const [activeNoise, setActiveNoise] = useState<NoiseType>(NoiseType.NONE);
  
  // Parameters
  const [sigma, setSigma] = useState<number>(1.4);
  const [enablePreGaussian, setEnablePreGaussian] = useState<boolean>(false);
  const [threshold, setThreshold] = useState<number>(0); 
  const [preSigma, setPreSigma] = useState<number>(1.0); // Sigma separado para pré-suavização
  
  // Report State
  const [reportText, setReportText] = useState<string>('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);


  // Canvas Refs
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null); 


  // ==========================================
  // Helpers
  // ==========================================
  
  const getActiveKernel = useCallback((): Kernel3x3 | null => {
      if (activeFilter === FilterType.LOG) {
          return generateLoGKernel(sigma);
      }
      
      if (activeFilter === FilterType.NONE && enablePreGaussian) {
          return generateGaussianKernel(preSigma);
      }

      if (activeFilter === FilterType.SOBEL_MAG) return KERNELS[FilterType.SOBEL_X];
      if (activeFilter === FilterType.PREWITT_MAG) return KERNELS[FilterType.PREWITT_X];
      return KERNELS[activeFilter] || null;
  }, [activeFilter, sigma, enablePreGaussian, preSigma]);


  // ==========================================
  // Rendering Pipeline
  // ==========================================
  
  const processImage = useCallback(() => {
      const srcCanvas = originalCanvasRef.current;
      const destCanvas = processedCanvasRef.current;
      
      if (!srcCanvas || !destCanvas) return;
      
      const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      const destCtx = destCanvas.getContext('2d');
      
      if (!srcCtx || !destCtx) return;


      try {
        const imgData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
        
        // 1. Pré-processamento: Suavização Gaussiana (se habilitado e não for LoG)
        let processingData = imgData;
        
        if (enablePreGaussian && activeFilter !== FilterType.LOG) {
            const gaussianKernel = generateGaussianKernel(preSigma);
            processingData = applyConvolution(imgData, gaussianKernel.matrix, 0); 
        }

        // 2. Aplicação do Filtro Principal
        let resultImageData: ImageData;

        if (activeFilter === FilterType.NONE) {
            resultImageData = processingData;
        } 
        else if (activeFilter === FilterType.SOBEL_MAG) {
            const sx = applyConvolution(processingData, KERNELS[FilterType.SOBEL_X].matrix, threshold);
            const sy = applyConvolution(processingData, KERNELS[FilterType.SOBEL_Y].matrix, threshold);
            resultImageData = combineMagnitude(sx, sy, threshold);
        } 
        else if (activeFilter === FilterType.PREWITT_MAG) {
            const px = applyConvolution(processingData, KERNELS[FilterType.PREWITT_X].matrix, threshold);
            const py = applyConvolution(processingData, KERNELS[FilterType.PREWITT_Y].matrix, threshold);
            resultImageData = combineMagnitude(px, py, threshold);
        } 
        else if (activeFilter === FilterType.LOG) {
            resultImageData = applyLoGConvolution(processingData, sigma, threshold);
        }
        else {
            const kernel = KERNELS[activeFilter];
            resultImageData = kernel ? applyConvolution(processingData, kernel.matrix, threshold) : processingData;
        }

        destCtx.putImageData(resultImageData, 0, 0);
        
      } catch (error) {
        console.error("Erro no processamento da imagem:", error);
      }
  }, [activeFilter, sigma, threshold, enablePreGaussian, preSigma]);


  // Main Effect
  useEffect(() => {
    if (activeTab !== 'experiment') return;

    const renderTimer = setTimeout(() => {
        const srcCanvas = originalCanvasRef.current;
        const destCanvas = processedCanvasRef.current;
        
        if (!srcCanvas || !destCanvas) return;

        const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
        const destCtx = destCanvas.getContext('2d');
        
        if (!srcCtx || !destCtx) return;

        srcCanvas.width = 512;
        srcCanvas.height = 512;
        destCanvas.width = 512;
        destCanvas.height = 512;

        const drawAndProcess = () => {
            if (activeNoise !== NoiseType.NONE) {
                const imgData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
                const noisyData = applyNoise(imgData, activeNoise);
                srcCtx.putImageData(noisyData, 0, 0);
            }
            processImage();
        };

        if (selectedSource === ImageSource.UPLOAD && uploadedImageSrc) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                srcCtx.drawImage(img, 0, 0, 512, 512);
                drawAndProcess();
            };
            img.src = uploadedImageSrc;
        } else if (selectedSource !== ImageSource.UPLOAD) {
            drawSyntheticImage(srcCtx, selectedSource, 512, 512);
            drawAndProcess();
        } else {
            srcCtx.fillStyle = "#f8fafc"; 
            srcCtx.fillRect(0,0,512,512);
            destCtx.clearRect(0, 0, 512, 512);
        }
    }, 10); 

    return () => clearTimeout(renderTimer);

  }, [activeTab, selectedSource, uploadedImageSrc, processImage, activeNoise, activeFilter, sigma, threshold, enablePreGaussian, preSigma]); 


  // ==========================================
  // Handlers
  // ==========================================

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        setUploadedImageSrc(event.target?.result as string);
        setSelectedSource(ImageSource.UPLOAD);
        setActiveFilter(FilterType.NONE); 
    };
    reader.readAsDataURL(file);
    e.target.value = ''; 
  };


  const handleGenerateReport = async () => {
    const originalImg = originalCanvasRef.current?.toDataURL('image/png') || null;
    const processedImg = processedCanvasRef.current?.toDataURL('image/png') || null;
    const spectrumImg = spectrumCanvasRef.current?.toDataURL('image/png') || null;

    setActiveTab('report');
    
    if (selectedSource !== ImageSource.UPLOAD) {
        const customKernel = activeFilter === FilterType.LOG ? getActiveKernel() : undefined;
        const staticReport = getStaticReport(selectedSource, activeFilter, {
          original: originalImg,
          processed: processedImg,
          spectrum: spectrumImg
        }, customKernel);
        setReportText(staticReport);
        return;
    }

    setIsGeneratingReport(true);
    setReportText(''); 
    
    try {
        const text = await generateDSPReport(activeFilter, "imagem enviada");
        setReportText(`<div class="whitespace-pre-wrap font-sans">${text}</div>`);
    } catch (e) {
        setReportText("Erro ao conectar com a IA.");
    } finally {
        setIsGeneratingReport(false);
    }
  };


  const isSynthetic = selectedSource !== ImageSource.UPLOAD;


  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-slate-800 font-sans">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-blue-600 p-2 rounded-lg text-white shadow-blue-200 shadow-lg">
                <Activity size={24} />
             </div>
             <div>
                <h1 className="text-xl font-bold text-slate-900 leading-none tracking-tight">PDS Edge Detective</h1>
                <p className="text-xs text-slate-500 mt-1 font-medium">Tema 2.2: Detecção de Bordas & Padrões</p>
             </div>
          </div>
          
          <nav className="flex bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setActiveTab('experiment')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'experiment' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}>
                <Settings2 size={16} /> Laboratório
            </button>
            <button onClick={() => setActiveTab('report')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium ${activeTab === 'report' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600'}`}>
                <FileText size={16} /> Relatório Técnico
            </button>
          </nav>
        </div>
      </header>


      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        {activeTab === 'experiment' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-500">
                
                {/* Left Sidebar: Controles */}
                <div className="lg:col-span-3 space-y-6">
                    
                    {/* Seção: Fonte do Sinal */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2">
                            <ImageIcon size={14} /> Fonte do Sinal
                        </h2>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Padrões Sintéticos</label>
                                <select 
                                    className="block w-full rounded-lg border-gray-300 shadow-sm p-2.5 bg-gray-50 text-sm"
                                    value={selectedSource === ImageSource.UPLOAD ? '' : selectedSource}
                                    onChange={(e) => { if (e.target.value) setSelectedSource(e.target.value as ImageSource) }}
                                >
                                    <option value={ImageSource.SYNTHETIC_COMBINED}>Formas Combinadas</option>
                                    <option value={ImageSource.SYNTHETIC_CIRCLE}>Círculo (Curvas)</option>
                                    <option value={ImageSource.SYNTHETIC_RECT}>Retângulo (Quinas)</option>
                                </select>
                            </div>

                            {/* Ruído */}
                            <div className="pt-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                    <Waves size={14} className="text-gray-500" /> Adicionar Ruído (Teste)
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    <button onClick={() => setActiveNoise(NoiseType.NONE)} className={`text-xs px-2 py-1.5 rounded border ${activeNoise === NoiseType.NONE ? 'bg-gray-800 text-white' : 'bg-white text-gray-600'}`}>Sem Ruído</button>
                                    <div className="flex gap-2">
                                        <button onClick={() => setActiveNoise(NoiseType.GAUSSIAN)} className={`flex-1 text-xs px-2 py-1.5 rounded border ${activeNoise === NoiseType.GAUSSIAN ? 'bg-orange-600 text-white' : 'bg-white'}`}>Gaussiano</button>
                                        <button onClick={() => setActiveNoise(NoiseType.SALT_PEPPER)} className={`flex-1 text-xs px-2 py-1.5 rounded border ${activeNoise === NoiseType.SALT_PEPPER ? 'bg-orange-600 text-white' : 'bg-white'}`}>Salt/Pepper</button>
                                    </div>
                                </div>
                                <div className="flex items-start gap-1 mt-2">
                                    <HelpCircle size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-[10px] text-gray-500">Ruído Gaussiano: aleatório suave. Salt & Pepper: pixels pretos/brancos aleatórios.</p>
                                </div>
                            </div>

                            {/* Upload */}
                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200" />
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="bg-white px-2 text-xs text-gray-400 uppercase">ou enviar</span>
                                </div>
                            </div>

                            <label className={`flex flex-col items-center justify-center w-full px-4 py-6 border-2 border-dashed rounded-lg cursor-pointer ${selectedSource === ImageSource.UPLOAD ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
                                <div className="flex flex-col items-center justify-center pt-1 pb-2">
                                    <Upload className="w-8 h-8 mb-2 text-gray-400" />
                                    <p className="text-xs text-gray-500">Enviar Imagem</p>
                                    <p className="text-[10px] text-gray-400">JPG ou PNG</p>
                                </div>
                                <input type='file' className="hidden" accept="image/*" onChange={handleFileUpload} />
                            </label>
                        </div>
                    </div>


                    {/* Seção: Filtros */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                                <Settings2 size={14} /> Filtro de Borda
                            </h2>
                            {activeFilter !== FilterType.NONE && (
                                <button onClick={() => {
                                    setActiveFilter(FilterType.NONE); 
                                    setThreshold(0); 
                                    setEnablePreGaussian(false);
                                    setSigma(1.4);
                                    setPreSigma(1.0);
                                }} className="text-[10px] text-red-500 flex items-center gap-1">
                                    <RotateCcw size={10} /> Resetar
                                </button>
                            )}
                        </div>
                        
                        {/* Threshold Global */}
                        {activeFilter !== FilterType.NONE && (
                            <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200">
                                <label className="text-xs font-semibold text-gray-700 flex justify-between mb-1">
                                    <span>Limiar de Borda</span>
                                    <span>{threshold}</span>
                                </label>
                                <input 
                                    type="range" min="0" max="100" step="5" 
                                    value={threshold}
                                    onChange={(e) => setThreshold(parseInt(e.target.value))}
                                    className="w-full h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-gray-800"
                                />
                                <div className="flex items-start gap-1 mt-1">
                                    <HelpCircle size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-[10px] text-gray-500">Valores baixos preservam bordas fracas. Valores altos removem ruído.</p>
                                </div>
                            </div>
                        )}

                        {/* Lista de Filtros */}
                        <div className="space-y-1">
                             {[
                                { label: 'Sobel (Magnitude)', val: FilterType.SOBEL_MAG, desc: 'Gradiente + suavização leve' },
                                { label: 'Prewitt (Magnitude)', val: FilterType.PREWITT_MAG, desc: 'Gradiente simples' },
                                { label: 'Laplacian', val: FilterType.LAPLACIAN, desc: 'Derivada segunda' },
                                { label: 'LoG (Laplacian of Gaussian)', val: FilterType.LOG, desc: 'Suavização + bordas' },
                             ].map((opt) => (
                                 <div key={opt.val}>
                                    <button
                                        onClick={() => setActiveFilter(opt.val)}
                                        className={`w-full text-left px-3 py-2.5 rounded-md text-sm flex items-center justify-between ${activeFilter === opt.val ? 'bg-blue-600 text-white font-medium shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}
                                    >
                                        <div className="flex flex-col items-start">
                                            <span>{opt.label}</span>
                                            <span className="text-[10px] opacity-75">{opt.desc}</span>
                                        </div>
                                        {activeFilter === opt.val && <div className="w-2 h-2 bg-white rounded-full animate-pulse" />}
                                    </button>
                                 </div>
                             ))}
                        </div>

                        {/* Pré-Suavização para filtros não-LoG */}
                        {activeFilter !== FilterType.LOG && activeFilter !== FilterType.NONE && (
                            <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                                        <Sliders size={12} /> Pré-Suavização Gaussiana
                                    </label>
                                    <button 
                                        onClick={() => setEnablePreGaussian(!enablePreGaussian)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${enablePreGaussian ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}
                                    >
                                        {enablePreGaussian ? <ToggleRight size={16} className="text-blue-600"/> : <ToggleLeft size={16} />}
                                        {enablePreGaussian ? 'Ativo' : 'Inativo'}
                                    </button>
                                </div>
                                
                                {enablePreGaussian && (
                                    <div className="mt-2 animate-in slide-in-from-top-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs text-gray-600">Intensidade (σ): {preSigma.toFixed(1)}</span>
                                        </div>
                                        <input 
                                            type="range" min="0.5" max="3.0" step="0.1" 
                                            value={preSigma}
                                            onChange={(e) => setPreSigma(parseFloat(e.target.value))}
                                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                        <div className="flex items-start gap-1 mt-1">
                                            <HelpCircle size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
                                            <p className="text-[10px] text-gray-500">Suaviza a imagem antes da detecção de bordas. Reduz ruído mas pode borrar bordas finas.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Botão de Relatório */}
                    <button onClick={handleGenerateReport} className="w-full bg-slate-900 text-white py-4 rounded-xl shadow-lg hover:bg-slate-800 flex items-center justify-center gap-2">
                        {isSynthetic ? <Zap size={18} /> : <Cpu size={18} />} {isSynthetic ? 'Gerar Relatório Padrão' : 'Gerar Análise com IA'}
                    </button>

                    {/* Dica de Uso */}
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                            <Lightbulb size={16} className="text-blue-600" />
                            <span className="text-xs font-bold text-blue-800">Dica de Uso:</span>
                        </div>
                        <p className="text-xs text-blue-700">
                            1. Comece sem ruído para ver o comportamento ideal<br/>
                            2. Adicione ruído e ajuste o limiar<br/>
                            3. Use pré-suavização para filtros simples com muito ruído<br/>
                            4. LoG já inclui suavização interna
                        </p>
                    </div>
                </div>


                {/* Centro: Visualização */}
                <div className="lg:col-span-6 space-y-6">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                         <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                <ImageIcon size={16} className="text-gray-400"/> Visualização
                            </h3>
                            <span className="text-[10px] px-2 py-1 bg-gray-200 text-gray-600 rounded-full font-mono">512 x 512 px</span>
                        </div>
                        <div className="p-6 flex flex-col gap-6 bg-gray-50/30">
                            
                            {/* Canvas Original */}
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-end px-1">
                                    <span className="text-sm font-bold text-gray-600">Original</span>
                                    {activeNoise !== NoiseType.NONE && (
                                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-200">
                                            Ruído: {activeNoise}
                                        </span>
                                    )}
                                </div>
                                <canvas ref={originalCanvasRef} className="w-full aspect-square bg-white rounded-lg border-2 border-gray-200 shadow-md" />
                            </div>
                            
                            {/* Canvas Processado */}
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-end px-1">
                                    <span className="text-sm font-bold text-blue-600">Filtrada</span>
                                    <div className="flex gap-2">
                                        {threshold > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">Limiar: {threshold}</span>}
                                    </div>
                                </div>
                                <canvas ref={processedCanvasRef} className="w-full aspect-square bg-black rounded-lg border-2 border-blue-200 shadow-md" />
                                {activeFilter === FilterType.NONE && (
                                    <div className="text-center py-2 text-gray-400 text-sm">
                                        Selecione um filtro para visualizar o resultado
                                    </div>
                                )}
                            </div>

                            {/* Controles de Sigma (LoG) */}
                            <div className="mt-2 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                        <Sliders size={16} /> Parâmetros do Filtro
                                    </h4>
                                </div>
                                
                                {/* Sigma para LoG */}
                                {activeFilter === FilterType.LOG ? (
                                    <div className="animate-in slide-in-from-top-2">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-semibold text-gray-600 flex items-center gap-1">
                                                Suavização LoG (Sigma σ): <span className="text-blue-600">{sigma.toFixed(1)}</span>
                                            </span>
                                            <span className="text-[10px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                                                Kernel: {Math.max(3, Math.ceil(sigma * 6) % 2 === 0 ? Math.ceil(sigma * 6) + 1 : Math.ceil(sigma * 6))}px
                                            </span>
                                        </div>
                                        <input 
                                            type="range" min="0.5" max="5.0" step="0.1" 
                                            value={sigma}
                                            onChange={(e) => setSigma(parseFloat(e.target.value))}
                                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                        <div className="mt-2 flex justify-between text-xs text-gray-500 font-medium">
                                            <span className="flex items-center gap-1">
                                                <AlertCircle size={10} /> Menos Suavização
                                            </span>
                                            <span className="flex items-center gap-1">
                                                Mais Suavização <AlertCircle size={10} />
                                            </span>
                                        </div>
                                        <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-100">
                                            <p className="text-xs text-blue-800">
                                                <span className="font-bold">LoG (Laplacian of Gaussian):</span> Combina suavização gaussiana com detecção de bordas Laplacianas. 
                                                Sigma controla a intensidade da suavização:
                                                <br/>
                                                • <span className="font-semibold">Sigma baixo (0.5-1.5):</span> Bordas finas e precisas, sensível a ruído
                                                <br/>
                                                • <span className="font-semibold">Sigma alto (2.0-5.0):</span> Bordas grossas, forte supressão de ruído
                                            </p>
                                        </div>
                                    </div>
                                ) : activeFilter !== FilterType.NONE && enablePreGaussian ? (
                                    <div className="text-center p-4 text-gray-600">
                                        <Info size={20} className="mx-auto mb-2 text-blue-500" />
                                        <p className="text-sm">Pré-suavização ativa com σ = {preSigma.toFixed(1)}</p>
                                        <p className="text-xs text-gray-500">A suavização é aplicada antes do filtro de borda</p>
                                    </div>
                                ) : activeFilter !== FilterType.NONE ? (
                                    <div className="text-center p-4 text-gray-400">
                                        <AlertCircle size={20} className="mx-auto mb-2" />
                                        <p className="text-sm">Ative a pré-suavização ou selecione LoG para ajustar suavização</p>
                                    </div>
                                ) : (
                                    <div className="text-center p-4 text-gray-400">
                                        <Info size={20} className="mx-auto mb-2" />
                                        <p className="text-sm">Selecione um filtro para ver os parâmetros</p>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>


                {/* Direita: Análise */}
                <div className="lg:col-span-3 space-y-6">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-6 flex items-center gap-2">
                            <Activity size={14} /> Análise do Kernel
                        </h2>
                        <div className="space-y-8 flex-1">
                            <div>
                                <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                    <Settings2 size={12} /> Resposta ao Impulso h[n,m]
                                </h3>
                                <ImpulseResponseView kernel={getActiveKernel()} />
                            </div>
                            <div>
                                <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1">
                                    <Activity size={12} /> Resposta em Frequência |H(u,v)|
                                </h3>
                                <FrequencyResponseView ref={spectrumCanvasRef} kernel={getActiveKernel()} />
                            </div>
                            <div className="p-3 bg-gray-50 rounded border border-gray-200 text-xs text-gray-600">
                                <div className="flex items-center gap-2 mb-2">
                                    <HelpCircle size={14} className="text-gray-500" />
                                    <span className="font-bold">Interpretação:</span>
                                </div>
                                <p>• <span className="font-semibold">Filtros passa-baixa (Gaussiano):</span> Resposta concentrada no centro</p>
                                <p>• <span className="font-semibold">Filtros passa-alta (bordas):</span> Resposta nas bordas</p>
                                <p>• <span className="font-semibold">LoG (passa-banda):</span> Resposta em anel</p>
                                <p className="mt-2 text-[10px] text-gray-500">DC no centro do espectro representa frequência zero</p>
                            </div>
                        </div>
                    </div>
                </div>


            </div>
        ) : (
            /* Report View */
            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50 no-print">
                        <div className="flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Relatório Técnico</h2>
                                <p className="text-gray-500 text-sm mt-1">Projeto Final PDS 2025.4 - Unifesspa</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setActiveTab('experiment')} className="px-4 py-2 border rounded hover:bg-gray-50">Voltar ao Laboratório</button>
                                <button onClick={() => window.print()} className="px-4 py-2 bg-slate-900 text-white rounded flex items-center gap-2">
                                    <Download size={16} /> Salvar PDF
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="p-8 min-h-[500px]">
                        {isGeneratingReport ? (
                            <div className="flex flex-col items-center justify-center h-64 space-y-6">
                                <div className="relative">
                                    <div className="h-16 w-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Cpu size={24} className="text-blue-600 animate-pulse" />
                                    </div>
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-lg font-medium text-gray-900">Gerando análise...</p>
                                </div>
                            </div>
                        ) : reportText ? (
                            <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-a:text-blue-600" dangerouslySetInnerHTML={{ __html: reportText }} />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400 space-y-4">
                                <FileText size={48} className="opacity-20" />
                                <p>Nenhum relatório gerado ainda.</p>
                                <button onClick={handleGenerateReport} className="text-blue-600 hover:underline text-sm">
                                    Gerar relatório
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
};


export default App;