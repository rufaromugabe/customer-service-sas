import { OpenAI } from "openai";
import { Prisma, PrismaClient } from "@prisma/client";

// Define the PrismaClient type for better type inference with extensions
type ExtendedPrismaClient = PrismaClient<Prisma.PrismaClientOptions, never, Prisma.RejectOnNotFound | Prisma.RejectPerOperation | undefined, Prisma.DefaultArgs>;


const DEFAULT_EMBEDDING_MODEL = "nomic-ai/nomic-embed-text-v1.5";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

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
) {
  const embedding = await embedTask(title, EmbeddingTasks.SEARCH_QUERY);

  // get similar tasks, no need to filter by tenant because we are already in the tenant context
  // This queries the 'todos' table which represents 'Customer Interactions' for this AI demo
  const similarInteractions =
    await tenantNile.$queryRaw`SELECT title, estimate FROM todos WHERE
    embedding <-> ${embeddingToSQL(
      embedding
    )}::vector < 1 order by embedding <-> ${embeddingToSQL(
      embedding
    )}::vector limit 3`;

  console.log(`found ${similarInteractions.length} similar customer interactions`);

  return similarInteractions as CustomerInteraction[];
}

export async function aiEstimate(title: string, similarInteractions: CustomerInteraction[]) {
  const ai = new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL,
  });

  const model =
    process.env.AI_MODEL ||
    "accounts/fireworks/models/llama-v3p1-405b-instruct"; // Default for Fireworks

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
  });

  // if we got a valid response, return it
  if (aiEstimateResult.choices[0].finish_reason === "stop") {
    return aiEstimateResult.choices[0].message.content;
  }
  // otherwise, we simply don't have an estimate
  return "unknown";
}