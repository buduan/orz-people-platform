# Delivery Worker and local service topology

The backend package produces two deployment roles from one codebase: an HTTP process and a Worker
process. Both use PostgreSQL as the source of truth. The HTTP process commits Outbox rows but does
not call WebHook or mail providers. A dispatcher enqueues committed event/destination jobs, and the
Worker owns network delivery.

```text
NestJS HTTP -> PostgreSQL Outbox -> dispatcher -> Redis/BullMQ -> NestJS Worker
                                                     |              |-- WebHook
                                                     |              `-- email
                                                     `-- retry timing only
```

Queue jobs use a stable event/destination job id. WebHook destinations and email recipients are
separate jobs, so one failure cannot block another. The database delivery row remains authoritative;
Redis is not the only record of delivery state.

The BullMQ spike verifies a transient retry, independent webhook/email processing, duplicate job-id
suppression, and graceful `worker.close()`. BullMQ 5 performs stalled-job checks in Worker, so this
topology does not add the deprecated QueueScheduler.

## Local services

`compose.dev.yml` keeps PostgreSQL and Redis in the default profile. Optional delivery tools use the
`delivery` profile:

- Mailpit `v1.30.0`: SMTP on `1025`, UI/API on `8025` by default.
- Delivery sink: WebHook capture on `8085`, with `/health`, `/requests`, and controllable
  `?status=503&delayMs=100` responses. It retains at most 100 in-memory requests and only selected
  signature headers.

Start them with `pnpm start:delivery`. Production Compose does not include either test service.

Relevant implementation references:

- [BullMQ Workers](https://docs.bullmq.io/guide/workers)
- [BullMQ graceful shutdown](https://docs.bullmq.io/guide/workers/graceful-shutdown)
- [Mailpit Docker images](https://mailpit.axllent.org/docs/install/docker/)
