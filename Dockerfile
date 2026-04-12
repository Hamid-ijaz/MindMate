FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

FROM deps AS builder

WORKDIR /app

COPY . .

# Build-time placeholder URL so Next.js can evaluate server imports during build.
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mindmate_build
ENV DATABASE_URL=${DATABASE_URL}

RUN npm run prisma:generate
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache tini

COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npm run prisma:migrate:deploy && npm run start -- -p ${PORT}"]