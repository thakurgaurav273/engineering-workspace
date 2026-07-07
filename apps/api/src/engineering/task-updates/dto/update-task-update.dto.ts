import { PartialType } from '@nestjs/swagger';
import { CreateTaskUpdateDto } from './create-task-update.dto';

export class UpdateTaskUpdateDto extends PartialType(CreateTaskUpdateDto) {}
