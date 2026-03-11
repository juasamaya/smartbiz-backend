-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "environment" TEXT NOT NULL DEFAULT '2',
ADD COLUMN     "pin" TEXT DEFAULT '12345',
ADD COLUMN     "softwareId" TEXT,
ADD COLUMN     "technicalKey" TEXT DEFAULT 'fc8eac422eba16e22ffd8c6f94b3f40a6e38162c',
ADD COLUMN     "testSetId" TEXT;
