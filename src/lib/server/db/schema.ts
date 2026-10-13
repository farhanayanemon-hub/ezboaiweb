import {
        boolean,
        timestamp,
        pgTable,
        text,
        unique,
        primaryKey,
        integer,
        json,
        index,
        real,
} from "drizzle-orm/pg-core"
import type { AdapterAccountType } from "@auth/core/adapters"
import { randomUUID } from 'crypto';

// Note: db is exported from index.ts to avoid SvelteKit env issues with drizzle-kit

export const users = pgTable("user", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        name: text("name"),
        email: text("email").unique(),
        emailVerified: timestamp("emailVerified", { mode: "date" }),
        password: text('password'),
        image: text("image"),
        isAdmin: boolean("isAdmin").notNull().default(false),
        stripeCustomerId: text("stripeCustomerId"),
        subscriptionStatus: text("subscriptionStatus", { 
                enum: ["active", "canceled", "incomplete", "incomplete_expired", "past_due", "trialing", "unpaid"] 
        }).default("incomplete"),
        planTier: text("planTier", { 
                enum: ["free", "starter", "pro", "advanced"] 
        }).default("free"),
        marketingConsent: boolean("marketingConsent").notNull().default(false),
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
        profession: text("profession"),
        personalInstructions: text("personalInstructions"),
})

export const accounts = pgTable(
        "account",
        {
                userId: text("userId")
                        .notNull()
                        .references(() => users.id, { onDelete: "cascade" }),
                type: text("type").$type<AdapterAccountType>().notNull(),
                provider: text("provider").notNull(),
                providerAccountId: text("providerAccountId").notNull(),
                refresh_token: text("refresh_token"),
                access_token: text("access_token"),
                expires_at: integer("expires_at"),
                token_type: text("token_type"),
                scope: text("scope"),
                id_token: text("id_token"),
                session_state: text("session_state"),
        },
        (account) => [
                {
                        compoundKey: primaryKey({
                                columns: [account.provider, account.providerAccountId],
                        }),
                },
        ]
)

export const sessions = pgTable("session", {
        sessionToken: text("sessionToken").primaryKey(),
        userId: text("userId")
                .notNull()
                .references(() => users.id, { onDelete: "cascade" }),
        expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable(
        "verificationToken",
        {
                identifier: text("identifier").notNull(),
                token: text("token").notNull(),
                expires: timestamp("expires", { mode: "date" }).notNull(),
        },
        (verificationToken) => [
                {
                        compositePk: primaryKey({
                                columns: [verificationToken.identifier, verificationToken.token],
                        }),
                },
        ]
)

export const passwordResetTokens = pgTable(
        "passwordResetToken",
        {
                identifier: text("identifier").notNull(),
                token: text("token").notNull(),
                expires: timestamp("expires", { mode: "date" }).notNull(),
                createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
        },
        (passwordResetToken) => [
                {
                        compositePk: primaryKey({
                                columns: [passwordResetToken.identifier, passwordResetToken.token],
                        }),
                },
        ]
)

export const otpCodes = pgTable(
        "otp_code",
        {
                id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
                email: text("email").notNull(),
                code: text("code").notNull(),
                purpose: text("purpose").notNull().default("registration"),
                attempts: integer("attempts").notNull().default(0),
                maxAttempts: integer("max_attempts").notNull().default(5),
                expires: timestamp("expires", { mode: "date" }).notNull(),
                verified: boolean("verified").notNull().default(false),
                createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
        }
)

export const authenticators = pgTable(
        "authenticator",
        {
                credentialID: text("credentialID").notNull().unique(),
                userId: text("userId")
                        .notNull()
                        .references(() => users.id, { onDelete: "cascade" }),
                providerAccountId: text("providerAccountId").notNull(),
                credentialPublicKey: text("credentialPublicKey").notNull(),
                counter: integer("counter").notNull(),
                credentialDeviceType: text("credentialDeviceType").notNull(),
                credentialBackedUp: boolean("credentialBackedUp").notNull(),
                transports: text("transports"),
        },
        (authenticator) => [
                {
                        compositePK: primaryKey({
                                columns: [authenticator.userId, authenticator.credentialID],
                        }),
                },
        ]
)

export const images = pgTable("image", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        filename: text("filename").notNull(),
        userId: text("userId")
                .notNull()
                .references(() => users.id, { onDelete: "cascade" }),
        chatId: text("chatId"), // Optional - images may not always be associated with a specific chat
        mimeType: text("mimeType").notNull(),
        fileSize: integer("fileSize").notNull(),
        storageLocation: text("storageLocation").notNull().default("local"), // 'local' | 'r2'
        cloudPath: text("cloudPath"), // Path/key for cloud storage (null for local files)
        // Generation metadata (nullable for backward compatibility)
        prompt: text("prompt"), // Generation prompt
        model: text("model"), // Model name (e.g., "flux-schnell")
        aspectRatio: text("aspectRatio"), // e.g., "1:1", "16:9"
        seed: integer("seed"), // Random seed for reproducibility
        quality: text("quality"), // Quality setting (model-specific)
        style: text("style"), // Style setting (model-specific)
        numberOfImages: integer("numberOfImages"), // Number of images generated
        referenceImageUrl: text("referenceImageUrl"), // i2i reference image URL
        upscaleFactor: text("upscaleFactor"), // Upscale factor (e.g., "x2", "x4") - Google Upscaler
        compressionQuality: integer("compressionQuality"), // Compression quality (1-100) - Google Upscaler
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        // Composite index for library queries (order by createdAt DESC for user)
        // Reduces query time on Neon serverless from 100-200ms to 10-50ms
        index('images_user_created_idx').on(table.userId, table.createdAt),
        // Index for filtering by storage location (R2 vs local)
        index('images_storage_location_idx').on(table.storageLocation),
])

export const videos = pgTable("video", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        filename: text("filename").notNull(),
        userId: text("userId")
                .notNull()
                .references(() => users.id, { onDelete: "cascade" }),
        chatId: text("chatId"), // Optional - videos may not always be associated with a specific chat
        mimeType: text("mimeType").notNull(),
        fileSize: integer("fileSize").notNull(),
        duration: integer("duration"), // Video duration in seconds (8 for Veo 3)
        resolution: text("resolution"), // e.g., "720p"
        fps: integer("fps"), // Frames per second (24 for Veo 3)
        hasAudio: boolean("hasAudio").notNull().default(true), // Veo 3 generates audio natively
        storageLocation: text("storageLocation").notNull().default("local"), // 'local' | 'r2'
        cloudPath: text("cloudPath"), // Path/key for cloud storage (null for local files)
        // Generation metadata (nullable for backward compatibility)
        prompt: text("prompt"), // Generation prompt
        model: text("model"), // Model name (e.g., "ray-flash-2-720p")
        aspectRatio: text("aspectRatio"), // e.g., "16:9"
        seed: integer("seed"), // Random seed for reproducibility
        quality: text("quality"), // Quality setting (model-specific)
        style: text("style"), // Style setting (model-specific)
        imageStartUrl: text("imageStartUrl"), // i2v start frame URL
        imageEndUrl: text("imageEndUrl"), // i2v end frame URL
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        // Composite index for library queries (order by createdAt DESC for user)
        // Reduces query time on Neon serverless from 100-200ms to 10-50ms
        index('videos_user_created_idx').on(table.userId, table.createdAt),
        // Index for filtering by storage location (R2 vs local)
        index('videos_storage_location_idx').on(table.storageLocation),
])

export const audio = pgTable("audio", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        filename: text("filename").notNull(),
        userId: text("userId")
                .notNull()
                .references(() => users.id, { onDelete: "cascade" }),
        chatId: text("chatId"), // Optional - audio may not always be associated with a specific chat
        messageIndex: integer("messageIndex"), // Index of message in chat (for Read Aloud caching)
        mimeType: text("mimeType").notNull(),
        fileSize: integer("fileSize").notNull(),
        duration: integer("duration"), // Audio duration in seconds (estimated from text length)
        text: text("text").notNull(), // The original text that was converted to speech
        model: text("model").notNull(), // TTS model used (e.g., "eleven_multilingual_v2")
        voiceId: text("voiceId").notNull(), // Voice ID used for generation
        storageLocation: text("storageLocation").notNull().default("local"), // 'local' | 'r2'
        cloudPath: text("cloudPath"), // Path/key for cloud storage (null for local files)
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        // Composite index for library queries (order by createdAt DESC for user)
        index('audio_user_created_idx').on(table.userId, table.createdAt),
        // Index for filtering by storage location (R2 vs local)
        index('audio_storage_location_idx').on(table.storageLocation),
        // Composite index for Read Aloud cache lookups (userId, chatId, messageIndex)
        // Enables O(1) cache hit queries instead of O(n) full table scans
        index('audio_cache_lookup_idx').on(table.userId, table.chatId, table.messageIndex),
])

export const transcriptions = pgTable("transcriptions", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        filename: text("filename").notNull(),
        userId: text("userId")
                .notNull()
                .references(() => users.id, { onDelete: "cascade" }),
        chatId: text("chatId"), // Optional - transcription may not always be associated with a specific chat
        mimeType: text("mimeType").notNull(), // Original audio MIME type
        fileSize: integer("fileSize").notNull(), // Original audio file size
        duration: integer("duration"), // Audio duration in seconds
        text: text("text").notNull(), // Full transcribed text
        words: json("words").$type<Array<{ text: string; start: number; end: number }>>(), // Word-level timestamps for highlighting
        model: text("model").notNull(), // STT model used (e.g., "scribe_v1")
        storageLocation: text("storageLocation").notNull().default("local"), // 'local' | 'r2'
        cloudPath: text("cloudPath"), // Path/key for cloud storage (null for local files)
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        // Composite index for library queries (order by createdAt DESC for user)
        index('transcriptions_user_created_idx').on(table.userId, table.createdAt),
        // Index for filtering by storage location (R2 vs local)
        index('transcriptions_storage_location_idx').on(table.storageLocation),
])

export const voiceChanges = pgTable("voice_changes", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        // Output audio info (the transformed/converted audio)
        filename: text("filename").notNull(),
        mimeType: text("mimeType").notNull(),
        fileSize: integer("fileSize").notNull(),
        storageLocation: text("storageLocation").notNull().default("local"), // 'local' | 'r2'
        cloudPath: text("cloudPath"), // Path/key for cloud storage
        // Original audio info (for before/after comparison)
        originalFilename: text("originalFilename").notNull(),
        originalMimeType: text("originalMimeType").notNull(),
        originalFileSize: integer("originalFileSize").notNull(),
        originalStorageLocation: text("originalStorageLocation").notNull().default("local"),
        originalCloudPath: text("originalCloudPath"),
        // Metadata
        userId: text("userId")
                .notNull()
                .references(() => users.id, { onDelete: "cascade" }),
        chatId: text("chatId"), // Optional - voice change may not always be associated with a specific chat
        duration: integer("duration"), // Audio duration in seconds
        targetVoiceId: text("targetVoiceId").notNull(), // Voice ID used for conversion
        model: text("model").notNull(), // STS model used (e.g., "eleven_multilingual_sts_v2")
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        // Composite index for library queries (order by createdAt DESC for user)
        index('voice_changes_user_created_idx').on(table.userId, table.createdAt),
        // Index for filtering by storage location (R2 vs local)
        index('voice_changes_storage_location_idx').on(table.storageLocation),
])

export const music = pgTable("music", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        filename: text("filename").notNull(),
        userId: text("userId")
                .notNull()
                .references(() => users.id, { onDelete: "cascade" }),
        chatId: text("chatId"), // Optional - music may not always be associated with a specific chat
        mimeType: text("mimeType").notNull(),
        fileSize: integer("fileSize").notNull(),
        durationMs: integer("durationMs"), // Music duration in milliseconds
        prompt: text("prompt").notNull(), // The prompt used to generate music
        model: text("model").notNull(), // Music model used (e.g., "music_v1")
        isInstrumental: boolean("isInstrumental").notNull().default(false), // Whether music is instrumental only
        storageLocation: text("storageLocation").notNull().default("local"), // 'local' | 'r2'
        cloudPath: text("cloudPath"), // Path/key for cloud storage (null for local files)
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        // Composite index for library queries (order by createdAt DESC for user)
        index('music_user_created_idx').on(table.userId, table.createdAt),
        // Index for filtering by storage location (R2 vs local)
        index('music_storage_location_idx').on(table.storageLocation),
])

export const soundEffects = pgTable("sound_effects", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        filename: text("filename").notNull(),
        userId: text("userId")
                .notNull()
                .references(() => users.id, { onDelete: "cascade" }),
        chatId: text("chatId"), // Optional - sound effects may not always be associated with a specific chat
        mimeType: text("mimeType").notNull(),
        fileSize: integer("fileSize").notNull(),
        durationSeconds: real("durationSeconds"), // Sound effect duration in seconds
        text: text("text").notNull(), // The description used to generate the sound effect
        promptInfluence: real("promptInfluence"), // 0.0-1.0, how literally the prompt was interpreted
        model: text("model").notNull(), // Sound effect model used (e.g., "sound_effects_v1")
        storageLocation: text("storageLocation").notNull().default("local"), // 'local' | 'r2'
        cloudPath: text("cloudPath"), // Path/key for cloud storage (null for local files)
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        // Composite index for library queries (order by createdAt DESC for user)
        index('sound_effects_user_created_idx').on(table.userId, table.createdAt),
        // Index for filtering by storage location (R2 vs local)
        index('sound_effects_storage_location_idx').on(table.storageLocation),
])

export const projects = pgTable("project", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        userId: text("userId")
                .notNull()
                .references(() => users.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        description: text("description"),
        customInstructions: text("customInstructions"), // System prompt for this project
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
        updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        index('projects_user_created_idx').on(table.userId, table.createdAt),
])

export const projectFiles = pgTable("project_file", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        projectId: text("projectId")
                .notNull()
                .references(() => projects.id, { onDelete: "cascade" }),
        filename: text("filename").notNull(),
        mimeType: text("mimeType").notNull(),
        fileSize: integer("fileSize").notNull(), // bytes
        content: text("content").notNull(), // text content stored directly in DB
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        index('project_files_project_idx').on(table.projectId),
])

export const chats = pgTable("chat", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        userId: text("userId")
                .notNull()
                .references(() => users.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        model: text("model").notNull(),
        messages: json("messages").$type<Array<{
                role: 'user' | 'assistant' | 'system';
                content: string;
                model?: string;
                imageId?: string; // Reference to images table
                imageUrl?: string; // Deprecated, for backwards compatibility
                imageData?: string; // Deprecated, for backwards compatibility
                videoId?: string; // Reference to videos table
                mimeType?: string;
                type?: 'text' | 'image' | 'video';
        }>>().notNull().default([]),
        pinned: boolean("pinned").notNull().default(false),
        isBranch: boolean("isBranch").notNull().default(false),
        branchAtIndex: integer("branchAtIndex"),
        branchSourceChatId: text("branchSourceChatId"),
        projectId: text("projectId")
                .references(() => projects.id, { onDelete: "set null" }), // Chats preserved if project deleted
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
        updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        index('chats_project_idx').on(table.projectId),
])

export const pricingPlans = pgTable("pricing_plan", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        name: text("name").notNull(),
        tier: text("tier", { 
                enum: ["free", "starter", "pro", "advanced"] 
        }).notNull(),
        stripePriceId: text("stripePriceId").notNull().unique(),
        priceAmount: integer("priceAmount").notNull(), // Price in cents
        priceAmountBdt: integer("priceAmountBdt"), // Price in BDT paisa (for Opaybd), nullable
        currency: text("currency").notNull().default("usd"),
        billingInterval: text("billingInterval", { 
                enum: ["month", "year"] 
        }).notNull().default("month"),
        textGenerationLimit: integer("textGenerationLimit"), // null = unlimited
        imageGenerationLimit: integer("imageGenerationLimit"), // null = unlimited
        videoGenerationLimit: integer("videoGenerationLimit"), // null = unlimited
        audioGenerationLimit: integer("audioGenerationLimit"), // null = unlimited
        voiceGenerationLimit: integer("voiceGenerationLimit"), // null = unlimited
        features: json("features").$type<string[]>().notNull().default([]),
        allowedModels: json("allowedModels").$type<string[]>().notNull().default([]),
        isActive: boolean("isActive").notNull().default(true),
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
        updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
})

export const subscriptions = pgTable("subscription", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        userId: text("userId")
                .notNull()
                .references(() => users.id, { onDelete: "cascade" }),
        stripeSubscriptionId: text("stripeSubscriptionId").notNull().unique(),
        stripePriceId: text("stripePriceId").notNull(),
        planTier: text("planTier", { 
                enum: ["free", "starter", "pro", "advanced"] 
        }).notNull(),
        previousPlanTier: text("previousPlanTier", { 
                enum: ["free", "starter", "pro", "advanced"] 
        }), // Track previous plan for plan change analytics
        status: text("status", { 
                enum: ["active", "canceled", "incomplete", "incomplete_expired", "past_due", "trialing", "unpaid"] 
        }).notNull(),
        currentPeriodStart: timestamp("currentPeriodStart", { mode: "date" }).notNull(),
        currentPeriodEnd: timestamp("currentPeriodEnd", { mode: "date" }).notNull(),
        cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").notNull().default(false),
        canceledAt: timestamp("canceledAt", { mode: "date" }),
        endedAt: timestamp("endedAt", { mode: "date" }),
        planChangedAt: timestamp("planChangedAt", { mode: "date" }), // Track when plan was last changed
        paymentProvider: text("paymentProvider", {
                enum: ["stripe", "opaybd"]
        }).notNull().default("stripe"),
        opayTransactionId: text("opayTransactionId"),
        renewalRequired: boolean("renewalRequired").default(false),
        lastPaymentAmount: integer("lastPaymentAmount"),
        renewalReminderSentAt: timestamp("renewalReminderSentAt", { mode: "date" }),
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
        updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
})

export const usageTracking = pgTable("usage_tracking", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        userId: text("userId")
                .notNull()
                .references(() => users.id, { onDelete: "cascade" }),
        month: integer("month").notNull(), // 1-12
        year: integer("year").notNull(),
        textGenerationCount: integer("textGenerationCount").notNull().default(0),
        imageGenerationCount: integer("imageGenerationCount").notNull().default(0),
        videoGenerationCount: integer("videoGenerationCount").notNull().default(0),
        audioGenerationCount: integer("audioGenerationCount").notNull().default(0),
        lastResetAt: timestamp("lastResetAt", { mode: "date" }).notNull().defaultNow(),
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
        updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        unique('user_month_year_unique').on(table.userId, table.month, table.year),
])

export const paymentHistory = pgTable("payment_history", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        userId: text("userId")
                .references(() => users.id, { onDelete: "set null" }), // Keep payment records for audit/legal purposes
        stripePaymentIntentId: text("stripePaymentIntentId"),
        stripeInvoiceId: text("stripeInvoiceId"),
        subscriptionId: text("subscriptionId")
                .references(() => subscriptions.id, { onDelete: "set null" }),
        amount: integer("amount").notNull(), // Amount in cents
        currency: text("currency").notNull().default("usd"),
        status: text("status", { 
                enum: ["succeeded", "pending", "failed", "canceled", "refunded"] 
        }).notNull(),
        description: text("description"),
        paymentMethodType: text("paymentMethodType"), // card, bank_transfer, etc.
        last4: text("last4"), // Last 4 digits of payment method
        brand: text("brand"), // visa, mastercard, etc.
        paidAt: timestamp("paidAt", { mode: "date" }),
        paymentProvider: text("paymentProvider", {
                enum: ["stripe", "opaybd"]
        }).notNull().default("stripe"),
        opayTransactionId: text("opayTransactionId"),
        opayPaymentMethod: text("opayPaymentMethod"),
        opayPaymentFee: integer("opayPaymentFee"),
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
})

export const adminSettings = pgTable("admin_settings", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        key: text("key").notNull().unique(), // Setting key (e.g., 'site_name', 'stripe_public_key')
        value: text("value"), // Setting value (JSON for complex values)
        category: text("category").notNull(), // 'general', 'branding', 'payment', 'oauth'
        encrypted: boolean("encrypted").notNull().default(false), // Whether value is encrypted
        description: text("description"), // Human-readable description
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
        updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        index('admin_settings_category_idx').on(table.category),
])

export const favoriteModels = pgTable("favorite_model", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        userId: text("userId")
                .notNull()
                .references(() => users.id, { onDelete: "cascade" }),
        modelName: text("modelName").notNull(),
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        // Composite unique constraint: user can only favorite a model once
        unique('user_model_unique').on(table.userId, table.modelName),
        // Index for fast lookup of user's favorites
        index('favorite_models_user_idx').on(table.userId),
])

export const adminFiles = pgTable("admin_files", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        filename: text("filename").notNull(),
        originalName: text("originalName").notNull(),
        mimeType: text("mimeType").notNull(),
        size: integer("size").notNull(), // File size in bytes
        category: text("category").notNull(), // 'logo', 'favicon', etc.
        path: text("path").notNull(), // File storage path
        url: text("url"), // Public URL if applicable
        storageLocation: text("storage_location").notNull().default('local'), // 'local' or 'r2'
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
        updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        index('admin_files_category_idx').on(table.category),
])

export const creditPlans = pgTable("credit_plan", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        name: text("name").notNull(),
        description: text("description"),
        // Legacy single-type column. Kept for backwards compatibility with old
        // rows and any code path that still reads it. New code should prefer
        // `creditTypes` (the multi-select array) and fall back to this when the
        // array is null.
        creditType: text("creditType", {
                enum: ["text", "image", "video", "audio"]
        }).notNull(),
        // New: a credit plan may grant credits across MULTIPLE categories at
        // once (e.g. one purchase = N text credits + N image credits).
        // Stored as a Postgres text[] of values from
        // {"text","image","video","audio"}. Nullable so that historical rows
        // created before this column existed continue to load — readers should
        // treat a null/empty value as `[creditType]`.
        creditTypes: text("creditTypes").array(),
        // Per-type credit amounts when a plan grants different amounts per
        // category (e.g. {text: 1000, image: 50, video: 10}). When null, the
        // legacy `creditAmount` is granted to every selected type. New rows
        // should always populate this; legacy reader fallback kept for safety.
        creditAmounts: json("creditAmounts").$type<Record<string, number>>(),
        creditAmount: integer("creditAmount").notNull(),
        priceAmount: integer("priceAmount").notNull(),
        priceAmountBdt: integer("priceAmountBdt"),
        currency: text("currency").notNull().default("usd"),
        isActive: boolean("isActive").notNull().default(true),
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
        updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
})

export const userCredits = pgTable("user_credit", {
        id: text("id")
                .primaryKey()
                .$defaultFn(() => randomUUID()),
        userId: text("userId")
                .notNull()
                .references(() => users.id, { onDelete: "cascade" }),
        creditType: text("creditType", {
                enum: ["text", "image", "video", "audio"]
        }).notNull(),
        creditAmount: integer("creditAmount").notNull(),
        purchasedAmount: integer("purchasedAmount").notNull(),
        creditPlanId: text("creditPlanId")
                .references(() => creditPlans.id, { onDelete: "set null" }),
        paymentProvider: text("paymentProvider", {
                enum: ["stripe", "opaybd"]
        }).notNull().default("stripe"),
        transactionId: text("transactionId"),
        purchasedAt: timestamp("purchasedAt", { mode: "date" }).notNull().defaultNow(),
        expiresAt: timestamp("expiresAt", { mode: "date" }),
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        index('user_credits_user_type_idx').on(table.userId, table.creditType),
])

export const manualOrders = pgTable("manual_orders", {
        id: text("id").primaryKey().$defaultFn(() => randomUUID()),
        userId: text("userId").references(() => users.id, { onDelete: "set null" }),
        userEmail: text("userEmail"),
        orderType: text("orderType", { enum: ["subscription", "credit"] }).notNull().default("subscription"),
        planId: text("planId"),
        planName: text("planName"),
        planTier: text("planTier", { enum: ["free", "starter", "pro", "advanced"] }),
        creditPlanId: text("creditPlanId"),
        gateway: text("gateway", { enum: ["paypal", "wise", "skrill", "binance", "bybit", "manual", "stripe", "opaybd", "bkash", "nagad", "rocket"] }).notNull().default("manual"),
        amount: integer("amount").notNull(),
        currency: text("currency").notNull().default("usd"),
        status: text("status", { enum: ["new", "pending", "completed", "cancelled"] }).notNull().default("new"),
        txnReference: text("txnReference"),
        senderInfo: text("senderInfo"),
        proofUrl: text("proofUrl"),
        userNotes: text("userNotes"),
        adminNotes: text("adminNotes"),
        completedBy: text("completedBy"),
        completedAt: timestamp("completedAt", { mode: "date" }),
        cancelledBy: text("cancelledBy"),
        cancelledAt: timestamp("cancelledAt", { mode: "date" }),
        createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
        updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
}, (table) => [
        index('manual_orders_status_idx').on(table.status),
        index('manual_orders_user_idx').on(table.userId),
])
