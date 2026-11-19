-- CreateTable
CREATE TABLE "assistant_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleContext" TEXT NOT NULL DEFAULT 'CLIENT',
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "engine" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_message_logs" (
    "id" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipientRole" TEXT NOT NULL,
    "recipientName" TEXT,
    "personalized" BOOLEAN NOT NULL DEFAULT false,
    "engine" TEXT NOT NULL DEFAULT 'none',
    "model" TEXT,
    "finalText" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_sessions_userId_roleContext_idx" ON "assistant_sessions"("userId", "roleContext");

-- CreateIndex
CREATE INDEX "assistant_messages_sessionId_createdAt_idx" ON "assistant_messages"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_message_logs_scenario_createdAt_idx" ON "ai_message_logs"("scenario", "createdAt");

-- CreateIndex
CREATE INDEX "ai_message_logs_createdAt_idx" ON "ai_message_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "assistant_sessions" ADD CONSTRAINT "assistant_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "assistant_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
