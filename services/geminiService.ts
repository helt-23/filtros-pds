import { GoogleGenAI } from "@google/genai";
import { FilterType } from "../types";

export const generateDSPReport = async (
  filterType: FilterType,
  imageDescription: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-2.5-flash";

  const prompt = `
    Contexto: Estou realizando um projeto universitário de Processamento Digital de Sinais (PDS).
    Tema: 2.2 Reconhecimento de Padrões e Características (Detecção de Bordas).
    
    Cenário:
    Eu apliquei o filtro "${filterType}" em uma imagem que contém "${imageDescription}".
    
    Tarefa:
    Escreva um "Relatório Técnico" curto (aproximadamente 3-4 parágrafos) em formato Markdown, em Português, cobrindo os seguintes pontos obrigatórios do PDF do projeto:
    
    1. **Introdução/Conceito**: Explique brevemente o que é este filtro (FIR, High-pass/Passa-altas) e como ele funciona matematicamente (convolução com kernel).
    2. **Análise de Frequência**: Explique a resposta em frequência deste filtro. Por que ele realça bordas? (Mencione altas frequências).
    3. **Análise de Resultados**: Descreva o que se espera ver na imagem resultante (bordas destacadas, áreas uniformes escuras).
    4. **Conclusão**: O filtro foi eficaz para extração de características?

    Use linguagem técnica adequada para um curso de Engenharia da Computação. Use LaTeX para fórmulas se necessário (ex: $H(e^{j\omega})$).
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Erro ao gerar relatório. Verifique sua chave de API ou tente novamente.";
  }
};