/*
  Warnings:

  - The primary key for the `Duel` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Message` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Session` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Subscription` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Thread` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `UsageLedger` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "Duel" DROP CONSTRAINT "Duel_threadId_fkey";

-- DropForeignKey
ALTER TABLE "Duel" DROP CONSTRAINT "Duel_userMessageId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_threadId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_userId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_userId_fkey";

-- DropForeignKey
ALTER TABLE "Thread" DROP CONSTRAINT "Thread_userId_fkey";

-- DropForeignKey
ALTER TABLE "UsageLedger" DROP CONSTRAINT "UsageLedger_userId_fkey";

-- AlterTable
ALTER TABLE "Duel" DROP CONSTRAINT "Duel_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "threadId" SET DATA TYPE TEXT,
ALTER COLUMN "userMessageId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Duel_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Message" DROP CONSTRAINT "Message_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "threadId" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Message_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Session" DROP CONSTRAINT "Session_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Session_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Thread" DROP CONSTRAINT "Thread_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Thread_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "UsageLedger" DROP CONSTRAINT "UsageLedger_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "UsageLedger_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
