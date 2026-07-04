import { NextResponse } from "next/server";
import { ensureWorkspaceForUser, getAdminContext, getErrorMessage } from "@/lib/supabase/workspace-admin";

const assetBucket = "template-assets";
const maxAssetSize = 50 * 1024 * 1024;
const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif", "svg", "mp4", "webm", "mov", "json"]);

function cleanFileName(fileName: string) {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return safeName || `asset-${Date.now()}`;
}

function getExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

async function ensureAssetBucket(supabase: Awaited<ReturnType<typeof getAdminContext>>["supabase"]) {
  const { data: bucket } = await supabase.storage.getBucket(assetBucket);

  if (bucket) {
    return;
  }

  const { error } = await supabase.storage.createBucket(assetBucket, {
    public: true,
    fileSizeLimit: maxAssetSize,
  });

  if (error && !/already exists/i.test(error.message)) {
    throw error;
  }
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);
    await ensureAssetBucket(supabase);

    const { data: files, error } = await supabase.storage
      .from(assetBucket)
      .list(workspaceId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });

    if (error) {
      throw error;
    }

    const assets = (files || [])
      .filter((file) => file.name && !file.name.endsWith("/"))
      .map((file) => {
        const path = `${workspaceId}/${file.name}`;
        const { data } = supabase.storage.from(assetBucket).getPublicUrl(path);
        const metadata = file.metadata as { mimetype?: string; size?: number } | null;

        return {
          name: file.name,
          path,
          url: data.publicUrl,
          mimeType: metadata?.mimetype || "",
          size: metadata?.size || file.metadata?.size || 0,
          createdAt: file.created_at,
        };
      });

    return NextResponse.json({ assets });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Assets could not be loaded.") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAdminContext(request);
    const workspaceId = await ensureWorkspaceForUser(user);
    await ensureAssetBucket(supabase);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
    }

    if (file.size > maxAssetSize) {
      return NextResponse.json({ error: "Assets must be smaller than 50MB." }, { status: 400 });
    }

    const extension = getExtension(file.name);

    if (!allowedExtensions.has(extension)) {
      return NextResponse.json({ error: "Upload an image, SVG, GIF, video, or Lottie JSON file." }, { status: 400 });
    }

    const safeFileName = cleanFileName(file.name);
    const storagePath = `${workspaceId}/${Date.now()}-${safeFileName}`;
    const { error: uploadError } = await supabase.storage
      .from(assetBucket)
      .upload(storagePath, file, {
        contentType: file.type || (extension === "json" ? "application/json" : undefined),
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from(assetBucket).getPublicUrl(storagePath);

    return NextResponse.json({
      asset: {
        name: storagePath.split("/").pop() || safeFileName,
        path: storagePath,
        url: data.publicUrl,
        mimeType: file.type || "",
        size: file.size,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Asset could not be uploaded.") }, { status: 500 });
  }
}
