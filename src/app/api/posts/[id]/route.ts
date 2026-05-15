import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { ApiResponse } from "@/lib/utils/api-response";
import { logger } from "@/lib/utils/logger";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { s3Client, SPACES_BUCKET, DeleteObjectCommand } from "@/lib/utils/s3";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAnySession();
    if (!session?.user?.id) return ApiResponse.unauthorized();

    const { id } = await params;

    const post = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true, images: { select: { key: true } } },
    });

    if (!post) return ApiResponse.notFound("Post not found");
    if (post.authorId !== session.user.id) return ApiResponse.forbidden();

    // Delete images from S3
    if (SPACES_BUCKET && post.images.length > 0) {
      await Promise.allSettled(
        post.images.map((img) =>
          s3Client.send(new DeleteObjectCommand({ Bucket: SPACES_BUCKET, Key: img.key }))
        )
      );
    }

    await prisma.post.delete({ where: { id } });
    logger.info("[Posts DELETE] Deleted post", { postId: id });
    return ApiResponse.success({ id });
  } catch (error: any) {
    logger.error("[Posts DELETE] Error", { error: error.message });
    return ApiResponse.error(error.message || "Failed to delete post", 500);
  }
}
