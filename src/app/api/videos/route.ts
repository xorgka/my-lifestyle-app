import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/** public/videos 아래 카테고리 폴더. 폴더에 파일을 넣으면 홈 영상 카드에 자동으로 나타남 */
const CATEGORIES = ["인사이트", "운동", "기타"] as const;

const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".m4v", ".ogg"]);

export async function GET() {
  const baseDir = path.join(process.cwd(), "public", "videos");
  const categories: Record<string, string[]> = {};
  for (const category of CATEGORIES) {
    try {
      const files = await fs.readdir(path.join(baseDir, category));
      categories[category] = files
        .filter((f) => VIDEO_EXTENSIONS.has(path.extname(f).toLowerCase()))
        .sort()
        .map((f) => `/videos/${encodeURIComponent(category)}/${encodeURIComponent(f)}`);
    } catch {
      // 폴더 없으면 빈 목록
      categories[category] = [];
    }
  }
  return NextResponse.json({ categories });
}
