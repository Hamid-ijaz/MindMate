-- Remove residual Google Tasks sync schema artifacts after integration removal.

ALTER TABLE "Task" DROP COLUMN "syncToGoogleTasks";
ALTER TABLE "Task" DROP COLUMN "googleTaskId";
ALTER TABLE "Task" DROP COLUMN "googleTaskListId";
ALTER TABLE "Task" DROP COLUMN "googleTaskSyncStatus";
ALTER TABLE "Task" DROP COLUMN "googleTaskLastSync";
ALTER TABLE "Task" DROP COLUMN "googleTaskUrl";
ALTER TABLE "Task" DROP COLUMN "googleTaskError";

DROP TABLE "GoogleTasksSetting";
