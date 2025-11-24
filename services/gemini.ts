import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SyllabusTopic, DifficultyLevel } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Constants for Models
const MODEL_FAST = "gemini-2.5-flash";
// Using the same model for both as Flash is very capable for this and fast. 
// If higher reasoning is needed for advanced topics, we could switch to pro.

export const generateSyllabus = async (subject: string): Promise<Omit<SyllabusTopic, 'status'>[]> => {
  const prompt = `
    Create a comprehensive study syllabus for the subject: "${subject}".
    Structure the syllabus logically from Basic concepts, through Intermediate, to Advanced topics.
    Return the result as a strictly structured JSON array.
    Ensure topics are distinct and cover the entire learning path.
  `;

  const responseSchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "The name of the chapter or topic" },
        description: { type: Type.STRING, description: "A brief one-sentence overview of what this topic covers" },
        level: { 
          type: Type.STRING, 
          enum: [DifficultyLevel.Basic, DifficultyLevel.Intermediate, DifficultyLevel.Advanced] 
        },
      },
      required: ["title", "description", "level"],
    },
  };

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        systemInstruction: "You are an expert curriculum developer creating structured learning paths for students.",
      },
    });

    const data = JSON.parse(response.text || "[]");
    
    // Map to our internal type, adding IDs
    return data.map((item: any, index: number) => ({
      id: crypto.randomUUID(),
      title: item.title,
      description: item.description,
      level: item.level,
    }));
  } catch (error) {
    console.error("Gemini Syllabus Error:", error);
    throw new Error("Failed to generate syllabus.");
  }
};

export const generateTopicContent = async (subject: string, topic: SyllabusTopic): Promise<string> => {
  const prompt = `
    Write detailed study notes for the topic: "${topic.title}" within the subject: "${subject}".
    
    Target Audience: Students learning ${topic.level} level concepts.
    
    Requirements:
    1. Explain the core concepts clearly.
    2. PROVIDE REAL-LIFE EXAMPLES/ANALOGIES to make it easy to understand.
    3. Structure with Markdown headers (#, ##, ###).
    4. At the end, strictly add a section titled "### Recommended Study Videos" containing 3 search terms for YouTube that would show relevant tutorials. Format them as a list.
    
    Tone: Educational, encouraging, and clear.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_FAST, // using flash for speed, it's good at markdown generation
      contents: prompt,
      config: {
        // No schema here, we want freeform Markdown
        systemInstruction: "You are a helpful and knowledgeable AI tutor.",
      },
    });

    return response.text || "No content generated.";
  } catch (error) {
    console.error("Gemini Content Error:", error);
    throw new Error("Failed to generate content.");
  }
};