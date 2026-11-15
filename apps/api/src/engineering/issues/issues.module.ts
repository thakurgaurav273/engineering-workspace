import { Module } from "@nestjs/common";
import { NotificationsModule } from "@/platform/notifications/notifications.module";
import { GoalsModule } from "../goals/goals.module";
import {
  IssueCyclesController,
  IssueLabelsController,
  IssueProjectsController,
  IssueStatesController,
  IssuesController,
  IssueTeamsController,
} from "./issues.controller";
import { IssueAccess } from "./issue-access";
import { IssuesService } from "./issues.service";
import { TeamsService } from "./teams.service";
import { ProjectsService } from "./projects.service";
import { CyclesService } from "./cycles.service";
import { LabelsService } from "./labels.service";
import { StatesService } from "./states.service";

@Module({
  // GoalsModule: linked goals are re-measured when issues move.
  imports: [NotificationsModule, GoalsModule],
  // Order matters: IssuesController's `issues/:id` must come last.
  controllers: [
    IssueTeamsController,
    IssueProjectsController,
    IssueCyclesController,
    IssueLabelsController,
    IssueStatesController,
    IssuesController,
  ],
  providers: [IssueAccess, IssuesService, TeamsService, ProjectsService, CyclesService, LabelsService, StatesService],
})
export class IssuesModule {}
