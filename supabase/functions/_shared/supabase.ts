import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { HttpError } from "./http.ts";

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

export function createServiceClient() {
  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export function createUserClient(req: Request) {
  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    throw new HttpError(401, "Authorization header is required", { error: "unauthorized" });
  }

  return createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_ANON_KEY"),
    {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export async function requireAuthenticatedUser(req: Request) {
  const client = createUserClient(req);
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new HttpError(401, "You must be signed in", { error: "unauthorized" });
  }

  return { user: data.user, client };
}
