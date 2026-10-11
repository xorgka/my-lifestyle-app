import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * 처음 보는 음식의 단백질(g)을 Gemini로 추정한다.
 * 이미 아는 음식은 브라우저 쪽에서 저장된 값을 쓰고 여기로 안 온다.
 * 환경 변수: GEMINI_API_KEY (필수), GEMINI_MODEL (선택, 없으면 gemini-2.5-flash → gemini-flash-latest 순)
 */
const RequestSchema = z.object({
  foods: z
    .array(z.object({ name: z.string().min(1).max(100), kcal: z.number().min(0).max(10000) }))
    .min(1)
    .max(30),
});

const EstimateSchema = z.object({
  items: z.array(z.object({ index: z.number(), name: z.string().optional(), protein_g: z.number() })),
});

/** 연결 확인용: 브라우저에서 /api/diet/protein 을 열면 키 설정 여부와 시험 추정 결과를 보여준다 */
export async function GET(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ ok: false, keyConfigured: false, error: "GEMINI_API_KEY가 설정되지 않았어요" });
  }
  const test = new Request(req.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ foods: [{ name: "닭가슴살 100g", kcal: 110 }] }),
  });
  const res = await POST(test);
  const body = await res.json();
  return NextResponse.json({ ok: res.ok, keyConfigured: true, test: "닭가슴살 100g (110kcal)", result: body });
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되지 않았어요" }, { status: 503 });
  }
  const parsed = RequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });

  const list = parsed.data.foods.map((f, i) => `${i + 1}. ${f.name} (${f.kcal}kcal)`).join("\n");
  const prompt =
    "한국 식단 기록 앱의 영양 추정기다. 음식 이름(양이 적혀 있으면 그 양)과 칼로리를 보고 단백질 그램을 추정한다. " +
    "양이 없으면 칼로리를 1인분 크기의 단서로 쓴다. 목록의 모든 음식에 대해 하나씩, 목록 번호를 index에, 이름을 name에 넣고, protein_g는 소수점 한 자리까지의 숫자로 준다.\n\n" +
    `다음 음식들의 단백질(g)을 추정해 줘.\n${list}`;

  // 모델 이름이 바뀌어 없어졌으면(404) 다음 후보로
  const models = Array.from(new Set([process.env.GEMINI_MODEL, "gemini-2.5-flash", "gemini-flash-latest"].filter(Boolean) as string[]));
  let lastError = "";
  let estimate: z.infer<typeof EstimateSchema> | null = null;
  for (const model of models) {
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
                    properties: { index: { type: "INTEGER" }, name: { type: "STRING" }, protein_g: { type: "NUMBER" } },
                    required: ["index", "protein_g"],
                  },
                },
              },
              required: ["items"],
            },
          },
        }),
      });
    } catch {
      return NextResponse.json({ error: "Gemini에 연결하지 못했어요" }, { status: 502 });
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      // Gemini가 준 오류 문구를 그대로 전달 (키는 들어 있지 않음)
      lastError = `Gemini ${res.status} (${model}): ${data?.error?.message ?? res.statusText}`;
      if (res.status === 404) continue;
      return NextResponse.json({ error: lastError }, { status: res.status === 429 ? 429 : 502 });
    }
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    try {
      const result = EstimateSchema.safeParse(JSON.parse(text ?? ""));
      if (result.success) estimate = result.data;
    } catch {}
    if (!estimate) return NextResponse.json({ error: `Gemini 응답을 읽지 못했어요 (${model})` }, { status: 502 });
    break;
  }
  if (!estimate) return NextResponse.json({ error: lastError || "추정하지 못했어요" }, { status: 502 });

  // 이름은 AI가 조금 바꿔 적을 수 있어서 목록 번호로 맞춘다 (번호가 이상하면 이름으로)
  const foods = parsed.data.foods;
  const protein: Record<string, number> = {};
  for (const item of estimate.items) {
    const byIndex = Number.isInteger(item.index) ? foods[item.index - 1] : undefined;
    const food = byIndex ?? foods.find((f) => f.name.replace(/\s/g, "") === (item.name ?? "").replace(/\s/g, ""));
    if (food && Number.isFinite(item.protein_g) && item.protein_g >= 0) {
      protein[food.name] = Math.round(item.protein_g * 10) / 10;
    }
  }
  if (Object.keys(protein).length === 0) {
    return NextResponse.json({ error: "AI가 단백질 값을 주지 않았어요" }, { status: 502 });
  }
  return NextResponse.json({ protein });
}
