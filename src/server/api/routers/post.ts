import {
    CopyObjectCommand,
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import probe from "probe-image-size";
import type { Readable } from "stream";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { env } from "../../../env/server.mjs";
import { prisma } from "../../db";
import { s3Client, s3Server } from "../../s3";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const basePostInclude = {
    profile: {
        include: {
            header: true,
            avatar: true,
        },
    },
    attachments: {
        include: {
            file: true,
        },
    },
};

const postInclude = {
    ...basePostInclude,
    reblog: {
        include: basePostInclude,
    },
};

type Post = Prisma.PostGetPayload<{
    include: {
        profile: {
            include: {
                avatar: true;
            };
        };
        attachments: {
            include: {
                file: true;
            };
        };
        reblog: {
            include: {
                profile: {
                    include: {
                        avatar: true;
                    };
                };
                attachments: {
                    include: {
                        file: true;
                    };
                };
            };
        };
    };
}>;

type WithInteractions<T> = T & {
    isReblogged: boolean;
    isFavorited: boolean;
    reblog:
        | null
        | (T & {
              isReblogged: boolean;
              isFavorited: boolean;
          });
};

const computeInteractions = async (
    posts: Post[],
    profileId?: string
): Promise<WithInteractions<Post>[]> => {
    const reblogs = await prisma.post.findMany({
        where: {
            profileId,
            content: null,
            NOT: {
                reblogId: null,
            },
        },
    });

    const favorites = await prisma.favorite.findMany({
        where: {
            profileId,
        },
    });

    const reblogIds = reblogs.map((reblog) => reblog.reblogId);
    const favoriteIds = favorites.map((favorite) => favorite.postId);

    return posts.map((post: Post): WithInteractions<Post> => {
        let reblog: { reblog: null | WithInteractions<Post> } = {
            reblog: null,
        };

        if (post.reblog) {
            const isReblogged = reblogIds.includes(post.reblog.id);
            const isFavorited = favoriteIds.includes(post.reblog.id);

            reblog = {
                reblog: {
                    isReblogged,
                    isFavorited,
                    reblog: null,
                    ...post.reblog,
                },
            };
        }

        const isReblogged = reblogIds.includes(post.id);
        const isFavorited = favoriteIds.includes(post.id);

        return { isReblogged, isFavorited, ...post, ...reblog };
    });
};

export const postRouter = createTRPCRouter({
    getById: publicProcedure
        .input(z.object({ id: z.string(), profileId: z.string() }))
        .query(async ({ ctx, input }) => {
            const post = await ctx.prisma.post.findUniqueOrThrow({
                where: {
                    id: input.id,
                },
                include: postInclude,
            });

            return await computeInteractions([post], input.profileId);
        }),
    getRepliesById: publicProcedure
        .input(z.object({ id: z.string(), profileId: z.string() }))
        .query(async ({ ctx, input }) => {
            const replies = await ctx.prisma.post.findMany({
                where: {
                    inReplyToId: input.id,
                },
                include: postInclude,
            });

            return await computeInteractions(replies, input.profileId);
        }),
    getByProfileId: publicProcedure
        .input(
            z.object({
                filter: z.optional(
                    z.literal("with-replies").or(z.literal("media"))
                ),
                profileId: z.string(),
            })
        )
        .query(async ({ ctx, input }) => {
            let filter: { inReplyToId?: null; attachments?: { some: object } } =
                {
                    inReplyToId: null,
                };

            if (input.filter === "with-replies") {
                filter = {};
            }

            if (input.filter === "media") {
                filter = {
                    attachments: {
                        some: {},
                    },
                };
            }

            // TODO: Filter on account
            const posts = await ctx.prisma.post.findMany({
                where: {
                    ...filter,
                    profileId: input.profileId,
                },
                orderBy: [
                    {
                        createdAt: "desc",
                    },
                ],
                include: postInclude,
            });

            return await computeInteractions(posts, input.profileId);
        }),
    getFeedByProfileId: publicProcedure
        .input(z.object({ profileId: z.string() }))
        .query(async ({ ctx, input }) => {
            const follows = await ctx.prisma.follow.findMany({
                where: {
                    followerId: input.profileId,
                },
            });

            // TODO: Make protected
            const posts = await ctx.prisma.post.findMany({
                where: {
                    inReplyToId: null,
                    profileId: {
                        in: [
                            input.profileId,
                            ...follows.map((follow) => follow.followedId),
                        ],
                    },
                },
                orderBy: [
                    {
                        createdAt: "desc",
                    },
                ],
                include: postInclude,
            });

            return await computeInteractions(posts, input.profileId);
        }),
    search: publicProcedure
        .input(
            z.object({
                profileId: z.string(),
                content: z.string(),
                username: z.string(),
            })
        )
        .query(async ({ ctx, input }) => {
            let filter: {
                content?: { contains: string };
                profile?: { username: string };
            } = {};

            if (input.content.length > 0) {
                filter = {
                    content: {
                        contains: input.content,
                    },
                };
            }

            if (input.username.length > 0) {
                filter = {
                    ...filter,
                    profile: {
                        username: input.username,
                    },
                };
            }

            const posts = await ctx.prisma.post.findMany({
                where: filter,
                include: postInclude,
            });

            return await computeInteractions(posts, input.profileId);
        }),
    create: protectedProcedure
        .input(
            z
                .object({
                    profileId: z.string(),
                    inReplyToId: z.string(),
                    reblogId: z.string(),
                    content: z.string(),
                    files: z
                        .array(
                            z.object({
                                key: z.string().min(1),
                                ext: z.string().min(1),
                            })
                        )
                        .max(4),
                })
                .partial({
                    inReplyToId: true,
                    reblogId: true,
                    content: true,
                    files: true,
                })
                .refine(
                    ({ inReplyToId, reblogId, content, files }) =>
                        inReplyToId ||
                        reblogId ||
                        content ||
                        (files && files.length > 0),
                    { message: "Content, reblog, or files are required" }
                )
        )
        .mutation(async ({ ctx, input }) => {
            return await ctx.prisma.$transaction(async (tx) => {
                const session = ctx.session;
                const files = input.files;

                const hasPermission = await ctx.prisma.profile
                    .findFirst({
                        where: {
                            id: input.profileId,
                            userId: session.user.id,
                        },
                    })
                    .then((r) => Boolean(r));

                if (!hasPermission) {
                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: "You do not have access to this profile.",
                    });
                }

                // TODO: Validate reblog post exists
                const post = await tx.post.create({
                    data: {
                        inReplyToId: input.inReplyToId,
                        reblogId: input.reblogId,
                        profileId: input.profileId,
                        content: input.content,
                    },
                });

                if (input.inReplyToId) {
                    await tx.post.update({
                        where: { id: input.inReplyToId },
                        data: { repliesCount: { increment: 1 } },
                    });
                }

                if (input.reblogId) {
                    await tx.post.update({
                        where: { id: input.reblogId },
                        data: { reblogsCount: { increment: 1 } },
                    });
                }

                if (files) {
                    for (const upload of files) {
                        const uuid = uuidv4();
                        const name = uuid + "." + upload.ext;

                        await s3Server.send(
                            new CopyObjectCommand({
                                Bucket: env.S3_BUCKET,
                                CopySource: `${env.S3_BUCKET}/${upload.key}`,
                                Key: name,
                            })
                        );

                        await s3Server.send(
                            new DeleteObjectCommand({
                                Bucket: env.S3_BUCKET,
                                Key: upload.key,
                            })
                        );

                        const object = await s3Server.send(
                            new GetObjectCommand({
                                Bucket: env.S3_BUCKET,
                                Key: name,
                            })
                        );

                        const fileType = await probe(object.Body as Readable);

                        if (
                            !object.ContentLength ||
                            !fileType ||
                            upload.ext !== fileType.type
                        ) {
                            throw new TRPCError({
                                code: "BAD_REQUEST",
                                message: "Invalid file uploaded.",
                            });
                        }

                        const file = await tx.file.create({
                            data: {
                                type: "IMAGE",
                                url: env.S3_WEB_ENDPOINT + "/" + name,
                                mime: fileType.mime,
                                extension: upload.ext,
                                name,
                                size: object.ContentLength,
                                width: fileType.height,
                                height: fileType.width,
                            },
                        });

                        await tx.attachment.create({
                            data: {
                                postId: post.id,
                                fileId: file.id,
                            },
                        });
                    }
                }

                const createdPost = await tx.post.findUniqueOrThrow({
                    where: {
                        id: post.id,
                    },
                    include: postInclude,
                });

                return {
                    isReblogged: false,
                    isFavorited: false,
                    ...createdPost,
                };
            });
        }),
    createPresignedUrls: protectedProcedure
        .input(z.object({ count: z.number().gte(1).lte(4) }))
        .query(async ({ input }) => {
            const urls = [];

            for (let i = 0; i < input.count; i++) {
                const key = uuidv4();

                const url = await getSignedUrl(
                    s3Client,
                    new PutObjectCommand({
                        Bucket: env.S3_BUCKET,
                        Key: key,
                    })
                );

                urls.push({
                    url,
                    key,
                });
            }

            return urls;
        }),
});
