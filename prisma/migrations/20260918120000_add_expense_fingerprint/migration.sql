-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "fingerprint" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Expense_fingerprint_key" ON "Expense"("fingerprint");

