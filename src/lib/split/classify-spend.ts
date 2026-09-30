import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SpendClassifyResult = {
  parts: Record<string, string>;
  source: "model" | "unavailable";
};

const inputSchema = z.object({
  titles: z.array(z.string().max(80)).max(40),
});

/** Ask a model which spending part each bill name belongs to. */
export const classifySpendTitles = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<SpendClassifyResult> => {
    const { classifyTitlesWithModel } = await import("./classify-spend.server");
    return classifyTitlesWithModel(data.titles);
  });
