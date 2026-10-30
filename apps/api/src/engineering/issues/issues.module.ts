import { Module } from "@nestjs/common";
import { NotificationsModule } from "@/platform/notifications/notifications.module";
import {
  IssueCyclesController,
  IssueLabelsController,
  IssueProjectsController,
  IssuesController,
  IssueTeamsController,
} from "./issues.controller";
import { IssueAccess } from "./issue-access";
import { IssuesService } from "./issues.service";
import { TeamsService } from "./teams.service";
import { ProjectsService } from "./projects.service";
import { CyclesService } from "./cycles.service";
import { LabelsService } from "./labels.service";

@Module({
  imports: [NotificationsModule],
  // Order matters: IssuesController's `issues/:id` must come last.
  controllers: [
    IssueTeamsController,
    IssueProjectsController,
    IssueCyclesController,
    IssueLabelsController,
    IssuesController,
  ],
  providers: [IssueAccess, IssuesService, TeamsService, ProjectsService, CyclesService, LabelsService],
})
export class IssuesModule {}
