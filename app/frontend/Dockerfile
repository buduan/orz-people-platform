FROM node:22-alpine AS build

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY app/frontend/package.json app/frontend/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/utils/package.json packages/utils/package.json

RUN pnpm install --frozen-lockfile

COPY app/frontend app/frontend
COPY packages/types packages/types
COPY packages/utils packages/utils

RUN pnpm --filter @orz-people-platform/types build \
  && pnpm --filter @orz-people-platform/utils build \
  && pnpm --filter @orz-people-platform/frontend build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

COPY --from=build /workspace/app/frontend/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
