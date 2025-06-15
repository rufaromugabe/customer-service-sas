import { OpenAI } from "openai";
import { Prisma, PrismaClient } from "@prisma/client";

// Define the PrismaClient type for better type inference with extensions
type ExtendedPrismaClient = PrismaClient;


const DEFAULT_EMBEDDING_MODEL = "nomic-ai/nomic-embed-text-v1.5";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

// This constant defines the threshold for vector similarity searches
// Lower values are more strict, higher values return more results
const VECTOR_SIMILARITY_THRESHOLD = 0.8;

export enum EmbeddingTasks {
  SEARCH_DOCUMENT = "search_document:",
  SEARCH_QUERY = "search_query:",
}

export interface CustomerInteraction { // Renamed from Todo to fit domain
  title: string;
  estimate: string;
}

export function embeddingToSQL(embedding: number[]) {
  return JSON.stringify(embedding);
}

// Optimize input for the specific embedding model
function adjust_input(text: string, task: EmbeddingTasks): string {
  if (EMBEDDING_MODEL?.indexOf("nomic") >= 0) {
    return task + text;
  } else {
    return text;
  }
}

export async function embedTask(title: string, task: EmbeddingTasks) {
  const ai = new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL,
  });

  // generate embeddings
  let resp = await ai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: adjust_input(title, task),
  });

  // OpenAI's response is an object with an array of
  // objects that contain the vector embeddings
  // We just return the vector embeddings
  return resp.data[0].embedding;
}

export async function findSimilarCustomerInteractions(
  tenantNile: ExtendedPrismaClient, // Use the extended client type
  title: string
) {  const embedding = await embedTask(title, EmbeddingTasks.SEARCH_QUERY);

  // Optimized query using the Nile/PostgreSQL vector operators with index hint
  // This uses the vector index if available and speeds up similarity search
  const similarInteractions: unknown[] =
    await tenantNile.$queryRaw`
      /*+ IndexScan(todos todos_embedding_idx) */
      SELECT title, estimate FROM todos 
      WHERE embedding IS NOT NULL 
      AND embedding <-> ${embeddingToSQL(embedding)}::vector < ${VECTOR_SIMILARITY_THRESHOLD}
      ORDER BY embedding <-> ${embeddingToSQL(embedding)}::vector
      LIMIT 3`;

  console.log(`found ${(similarInteractions as any[]).length} similar customer interactions`);

  return similarInteractions as CustomerInteraction[];
}

export async function aiEstimate(title: string, similarInteractions: CustomerInteraction[]) {
  try {
    // Check if we even have similar interactions to use as reference
    if (!similarInteractions || similarInteractions.length === 0) {
      console.log("No similar interactions found, using default estimate");
      return "Medium complexity (1-3 days)";
    }

    const ai = new OpenAI({
      apiKey: process.env.AI_API_KEY,
      baseURL: process.env.AI_BASE_URL,
    });

    const model =
      process.env.AI_MODEL ||
      "accounts/fireworks/models/llama-v3p1-405b-instruct"; // Default for Fireworks

    // Added timeout to prevent long-running requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    const aiEstimateResult = await ai.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `You are an amazing project manager for customer service. I need to resolve the customer issue: "${title}". How long do you think this will take, or what would be the complexity/effort?
          I have a few similar past customer interactions with their estimates/complexity, please use them as reference: ${JSON.stringify(
            similarInteractions
          )}.
          Respond with just the estimate or complexity, no extra text.`,
        },
      ],
      model: model,
      temperature: 0.7,
      max_tokens: 50,
    }, { signal: controller.signal });

    // Clear the timeout since we got a response
    clearTimeout(timeoutId);

    // if we got a valid response, return it
    if (aiEstimateResult.choices[0].finish_reason === "stop") {
      return aiEstimateResult.choices[0].message.content;
    }
    
    // otherwise, we simply don't have an estimate
    return "unknown";
  } catch (error: any) {
    console.error("Error in AI estimate generation:", error.message);
    // Provide a reasonable fallback based on similar interactions
    if (similarInteractions && similarInteractions.length > 0) {
      // Use the most common estimate from similar interactions
      const estimates = similarInteractions.map(si => si.estimate);
      const mostCommon = estimates.sort(
        (a, b) => estimates.filter(v => v === a).length - estimates.filter(v => v === b).length
      ).pop();
      return mostCommon || "Medium complexity (1-3 days)";
    }
    return "unknown";
  }
}