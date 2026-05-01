import { Module } from '@nestjs/common';
import { EntityTagsController } from './entity-tags.controller';
import { EntityTagsService } from './entity-tags.service';

@Module({
  controllers: [EntityTagsController],
  providers: [EntityTagsService],
  exports: [EntityTagsService]
})
export class EntityTagsModule {}
