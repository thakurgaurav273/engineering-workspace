import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class DelegateWorkspaceItemDto {
  @ApiProperty({ description: "Org member to hand this item off to" })
  @IsString()
  ownerId: string;
}
