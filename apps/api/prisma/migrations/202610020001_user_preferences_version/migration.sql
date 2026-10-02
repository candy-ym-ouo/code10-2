-- CreateEnum
CREATE TYPE "InterfaceTheme" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- AlterTable
ALTER TABLE "users"
  ADD COLUMN "theme" "InterfaceTheme" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
