// src/email/dto/update-template.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateTemplateDto } from './create-template.dto';

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}
