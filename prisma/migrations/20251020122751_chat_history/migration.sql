-- DropIndex
DROP INDEX "public"."ChatSession_walletAddress_key";

-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN     "title" TEXT NOT NULL DEFAULT 'New chat',
ALTER COLUMN "walletAddress" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "ChatSession_walletAddress_idx" ON "ChatSession"("walletAddress");

-- CreateIndex
CREATE INDEX "ChatSession_createdAt_idx" ON "ChatSession"("createdAt");
