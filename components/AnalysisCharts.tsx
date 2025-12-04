import React, { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Kernel3x3 } from '../types';
import { computeKernelSpectrum } from '../services/dspService';

interface ImpulseResponseProps {
  kernel: Kernel3x3 | null;
}

export const ImpulseResponseView: React.FC<ImpulseResponseProps> = ({ kernel }) => {
  if (!kernel) return <div className="text-gray-400 text-sm">Selecione um filtro</div>;

  const cols = kernel.matrix[0].length;
  // Reduce font size for larger kernels
  const isLarge = cols > 7;

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-sm border border-gray-200 w-full">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Resposta ao Impulso h[n,m]</h3>
      
      {/* Container com scroll para evitar explosão do layout com kernels grandes (LoG) */}
      <div className="w-full overflow-auto max-h-[250px] p-2 border border-gray-100 rounded bg-gray-50/50">
        <div 
            className="grid gap-1 mx-auto"
            style={{ 
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                minWidth: isLarge ? `${cols * 24}px` : 'auto', // Força largura mínima para scrollar
                width: isLarge ? 'fit-content' : 'auto'
            }}
        >
            {kernel.matrix.map((row, i) =>
            row.map((val, j) => (
                <div
                key={`${i}-${j}`}
                className={`
                    flex items-center justify-center border font-mono transition-colors rounded
                    ${isLarge ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-sm'}
                    ${val === 0 ? 'bg-white text-gray-300 border-gray-100' : 'bg-blue-50 text-blue-800 font-bold border-blue-200'}
                `}
                title={val.toFixed(2)}
                >
                {/* Exibir inteiros ou 1 decimal se couber */}
                {Math.abs(val) < 10 && val !== Math.round(val) ? val.toFixed(1) : Math.round(val)}
                </div>
            ))
            )}
        </div>
      </div>
      <p className="mt-3 text-xs text-center text-gray-500 max-w-[200px]">{kernel.description}</p>
    </div>
  );
};

interface FrequencyResponseProps {
  kernel: Kernel3x3 | null;
}

// Usando forwardRef para permitir que o App pai acesse o canvas para gerar o relatório
export const FrequencyResponseView = forwardRef<HTMLCanvasElement, FrequencyResponseProps>(({ kernel }, ref) => {
  const internalRef = useRef<HTMLCanvasElement>(null);

  useImperativeHandle(ref, () => internalRef.current!);

  useEffect(() => {
    if (!kernel || !internalRef.current) return;
    
    const size = 128; 
    const spectrum = computeKernelSpectrum(kernel.matrix, size);
    const canvas = internalRef.current;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
        const imgData = ctx.createImageData(size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const mag = spectrum[y][x];
                const r = Math.min(255, mag * 255 * 1.2); 
                const g = Math.min(255, mag * 200);
                const b = Math.min(255, mag * 100 + 50);
                
                const index = (y * size + x) * 4;
                imgData.data[index] = r;
                imgData.data[index+1] = g;
                imgData.data[index+2] = b;
                imgData.data[index+3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }
  }, [kernel]);

  if (!kernel) return <div className="text-gray-400 text-sm">Selecione um filtro</div>;

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-sm border border-gray-200 w-full">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Resp. Frequência 2D |H(u,v)|</h3>
      <div className="relative border border-gray-300 shadow-inner">
        <canvas 
            ref={internalRef} 
            width={128} 
            height={128} 
            className="w-32 h-32 image-pixelated bg-black"
            style={{ imageRendering: 'pixelated' }} 
        />
        <div className="absolute bottom-1 right-1 text-[10px] text-white bg-black/50 px-1 rounded">DC no centro</div>
      </div>
      <p className="mt-3 text-xs text-center text-gray-500 max-w-[200px]">
         Espectro de magnitude do kernel. Áreas brilhantes indicam ganho na frequência.
      </p>
    </div>
  );
});

interface SignalProfileProps {
    data: { x: number; intensity: number }[];
}

export const SignalProfileChart: React.FC<SignalProfileProps> = ({ data }) => {
    return (
        <div className="h-48 w-full bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
             <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Perfil de Intensidade (Linha Central)</h3>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="x" hide />
                    <YAxis domain={[0, 255]} hide />
                    <Tooltip 
                        contentStyle={{ fontSize: '12px', background: '#fff', border: '1px solid #ddd' }}
                        itemStyle={{ color: '#2563eb' }}
                        labelFormatter={() => ''}
                    />
                    <Line type="monotone" dataKey="intensity" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}