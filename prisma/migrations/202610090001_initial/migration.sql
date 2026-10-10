CREATE TABLE "User" ("id" UUID PRIMARY KEY,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "RemoteGame" ("id" UUID PRIMARY KEY,"ownerId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"localId" UUID NOT NULL,"payload" JSONB NOT NULL,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "RemoteGame_ownerId_localId_key" ON "RemoteGame"("ownerId","localId");
CREATE INDEX "RemoteGame_ownerId_updatedAt_idx" ON "RemoteGame"("ownerId","updatedAt");
CREATE TABLE "ModelMetadata" ("id" UUID PRIMARY KEY,"ownerId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"localId" UUID NOT NULL,"name" VARCHAR(64) NOT NULL,"hash" VARCHAR(64) NOT NULL,"generation" INTEGER NOT NULL,"completedBatches" INTEGER NOT NULL,"preset" VARCHAR(16) NOT NULL,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX "ModelMetadata_ownerId_localId_key" ON "ModelMetadata"("ownerId","localId");
CREATE INDEX "ModelMetadata_ownerId_updatedAt_idx" ON "ModelMetadata"("ownerId","updatedAt");
CREATE TABLE "RateBucket" ("id" VARCHAR(100) PRIMARY KEY,"count" INTEGER NOT NULL DEFAULT 1,"expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "RateBucket_expiresAt_idx" ON "RateBucket"("expiresAt");
