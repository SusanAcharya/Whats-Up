import { fetchArticleMeta } from "@/lib/images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url || !/^https?:\/\//i.test(url)) {
    return Response.json({ error: "bad url" }, { status: 400 });
  }
  try {
    const meta = await fetchArticleMeta(url.slice(0, 2000));
    return Response.json(
      {
        imageUrl: meta.imageUrl ?? null,
        excerpt: meta.excerpt ?? null,
        resolvedUrl: meta.resolvedUrl ?? null,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    return Response.json({ imageUrl: null }, { status: 200 });
  }
}
