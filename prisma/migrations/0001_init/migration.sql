-- Enable extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('A1', 'A2');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'assistant', 'system');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "plan" "Plan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Thread" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "lockedProvider" "Provider",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "threadId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Duel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "threadId" UUID NOT NULL,
    "userMessageId" UUID NOT NULL,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "uiOrderSeed" INTEGER NOT NULL,
    "chosen" "Provider",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Duel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLedger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "periodKey" TEXT NOT NULL,
    "messagesUsed" INTEGER NOT NULL DEFAULT 0,
    "verifiedUsed" INTEGER NOT NULL DEFAULT 0,
    "verifiedUsedToday" INTEGER NOT NULL DEFAULT 0,
    "verifiedDayKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Thread_userId_updatedAt_idx" ON "Thread"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_userId_idx" ON "Message"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Duel_threadId_key" ON "Duel"("threadId");

-- CreateIndex
CREATE UNIQUE INDEX "Duel_userMessageId_key" ON "Duel"("userMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageLedger_userId_periodKey_key" ON "UsageLedger"("userId", "periodKey");

-- CreateIndex
CREATE INDEX "UsageLedger_userId_idx" ON "UsageLedger"("userId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Duel" ADD CONSTRAINT "Duel_userMessageId_fkey" FOREIGN KEY ("userMessageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLedger" ADD CONSTRAINT "UsageLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
