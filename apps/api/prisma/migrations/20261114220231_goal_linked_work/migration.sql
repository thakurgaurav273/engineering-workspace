-- CreateTable
CREATE TABLE "_GoalProjects" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_GoalIssues" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_GoalProjects_AB_unique" ON "_GoalProjects"("A", "B");

-- CreateIndex
CREATE INDEX "_GoalProjects_B_index" ON "_GoalProjects"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_GoalIssues_AB_unique" ON "_GoalIssues"("A", "B");

-- CreateIndex
CREATE INDEX "_GoalIssues_B_index" ON "_GoalIssues"("B");

-- AddForeignKey
ALTER TABLE "_GoalProjects" ADD CONSTRAINT "_GoalProjects_A_fkey" FOREIGN KEY ("A") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GoalProjects" ADD CONSTRAINT "_GoalProjects_B_fkey" FOREIGN KEY ("B") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GoalIssues" ADD CONSTRAINT "_GoalIssues_A_fkey" FOREIGN KEY ("A") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GoalIssues" ADD CONSTRAINT "_GoalIssues_B_fkey" FOREIGN KEY ("B") REFERENCES "Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
