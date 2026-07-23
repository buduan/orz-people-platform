import { Global, Module } from '@nestjs/common';

import { JsonLogger } from './json-logger.service';

// JsonLogger is a stateless, cross-cutting logger injected by providers across
// several feature modules (e.g. AuthModule's OTP sender, the API exception
// filter). Exposing it from a global module makes it resolvable everywhere
// without each module re-declaring the provider.
@Global()
@Module({
  providers: [JsonLogger],
  exports: [JsonLogger],
})
export class ObservabilityModule {}
