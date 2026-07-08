import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { AttachmentInputDto } from "@/common/dto/attachment-input.dto";

export class CreateWorkspaceCommentDto {
  @ApiProperty({ example: "Following up with the client on this today." })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({ type: [String], description: "User ids @mentioned in the body" })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  mentionedUserIds?: string[];

  @ApiPropertyOptional({ type: [AttachmentInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentInputDto)
  @ArrayMaxSize(10)
  attachments?: AttachmentInputDto[];
}
