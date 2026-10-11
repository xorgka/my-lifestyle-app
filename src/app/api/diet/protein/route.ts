import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * 처음 보는 음식의 단백질(g)을 Gemini로 추정한다.
 * 이미 아는 음식은 브라우저 쪽에서 저장된 값을 쓰고 여기로 안 온다.
 * 환경 변수: GEMINI_API_KEY (필수), GEMINI_MODEL (선택, 기본 gemini-2.5-flash)
 */
const RequestSchema = z.object({
  foods: z
    .array(z.object({ name: z.string().min(1).max(100), kcal: z.number().min(0).max(10000) }))
    .min(1)
    .max(30),
});

const EstimateSchema = z.object({
  items: z.array(z.object({ name: z.string(), protein_g: z.number() })),
});

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았어요" }, { status: 503 });
  }
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const list = parsed.data.foods.map((f) => `- ${f.name} (${f.kcal}kcal)`).join("\n");
  const prompt =
    "한국 식단 기록 앱의 영양 추정기다. 음식 이름(양이 적혀 있으면 그 양)과 칼로리를 보고 단백질 그램을 추정한다. " +
    "양이 없으면 칼로리를 1인분 크기의 단서로 쓴다. 각 음식에 대해 입력한 이름을 그대로 name에 넣고, protein_g는 소수점 한 자리까지의 숫자로 준다.\n\n" +
    `다음 음식들의 단백질(g)을 추정해 줘.\n${list}`;

  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              items: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: { name: { type: "STRING" }, protein_g: { type: "NUMBER" } },
                  required: ["name", "protein_g"],
                },
              },
            },
            required: ["items"],
          },
        },
      }),
    });
  } catch {
    return NextResponse.json({ error: "AI에 연결하지 못했어요" }, { status: 502 });
  }
  if (res.status === 429) return NextResponse.json({ error: "잠시 후 다시 시도해 주세요" }, { status: 429 });
  if (!res.ok) return NextResponse.json({ error: `AI 오류 ${res.status}` }, { status: 502 });

  const data = await res.json().catch(() => null);
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  let estimate: z.infer<typeof EstimateSchema> | null = null;
  try {
    const result = EstimateSchema.safeParse(JSON.parse(text ?? ""));
    if (result.success) estimate = result.data;
  } catch {}
  if (!estimate) return NextResponse.json({ error: "추정하지 못했어요" }, { status: 502 });

  const wanted = new Set(parsed.data.foods.map((f) => f.name));
  const protein: Record<string, number> = {};
  for (const item of estimate.items) {
    if (wanted.has(item.name) && Number.isFinite(item.protein_g) && item.protein_g >= 0) {
      protein[item.name] = Math.round(item.protein_g * 10) / 10;
    }
  }
  return NextResponse.json({ protein });
}
