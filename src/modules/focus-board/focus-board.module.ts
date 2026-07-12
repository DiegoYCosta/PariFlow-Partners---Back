import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infra/database/prisma.module';
import { FocusBoardNotesController } from './focus-board-notes.controller';
import { FocusBoardNotesService } from './focus-board-notes.service';

@Module({
  imports: [PrismaModule],
  controllers: [FocusBoardNotesController],
  providers: [FocusBoardNotesService]
})
export class FocusBoardModule {}
