import { Module, Provider } from '@nestjs/common';

import { FleetController } from './fleet.controller';
import { FLEET_REPOSITORY, FleetRepository } from './fleet.repository';
import { FleetService } from './fleet.service';
import { MemoryFleetRepository } from './memory-fleet.repository';
import { SchoolsController } from './schools.controller';

/**
 * Selects the fleet data source. USE_PRISMA=true loads the Postgres repository
 * (dynamically imported so @prisma/client is never touched in memory mode);
 * otherwise the in-memory seed repository.
 */
const fleetRepositoryProvider: Provider = {
  provide: FLEET_REPOSITORY,
  useFactory: async (): Promise<FleetRepository> => {
    if (process.env.USE_PRISMA === 'true') {
      const [{ PrismaFleetRepository }, { getPrismaClient }] = await Promise.all([
        import('./prisma-fleet.repository'),
        import('../prisma/prisma.client'),
      ]);
      return new PrismaFleetRepository(await getPrismaClient());
    }
    return new MemoryFleetRepository();
  },
};

@Module({
  controllers: [FleetController, SchoolsController],
  providers: [FleetService, fleetRepositoryProvider],
  exports: [FleetService],
})
export class FleetModule {}
