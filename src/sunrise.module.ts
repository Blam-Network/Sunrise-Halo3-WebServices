import { Module, Global, ConsoleLogger } from '@nestjs/common';
import { ApplicationModule } from './application/application.module';
import { DomainModule } from './domain/domain.module';
import { ILoggerSymbol } from './ILogger';
import { PersistanceModule } from './infrastructure/persistance/persistance.module';
import { PresentationModule } from './infrastructure/presentation/presentation.module';
import { ShutdownObserver } from './ShutdownObserver';
import { DatabaseModule } from './db/database.module';

@Global()
@Module({
  imports: [
    ApplicationModule,
    DomainModule,
    PersistanceModule,
    PresentationModule,
    {
      global: true,
      module: DatabaseModule,
    },
  ],
  controllers: [],
  providers: [{ provide: ILoggerSymbol, useClass: ConsoleLogger }, ShutdownObserver],
  exports: [ILoggerSymbol],
})
export class SunriseModule {}
