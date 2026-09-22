import { TypeSafeClient } from "@typesafe-ai/sdk";

// The same client the CLI builds. Anything with a matching `systemOne` method also works.
export const client = new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY });
