FROM node:22-alpine AS builder
WORKDIR /app
# Alpine ships musl + OpenSSL 3.x by default; Prisma's engine detection needs
# openssl explicitly present to pick the right engine binary reliably.
RUN apk add --no-cache openssl
COPY package*.json ./
# npm install (not ci): the lockfile is generated on macOS during development,
# and some optional platform-specific transitive deps (e.g. google-auth-library's
# proxy-agent chain, pulled in by firebase-admin) resolve differently on Linux,
# which trips npm ci's strict lockfile-sync check.
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3001
# No migrations directory in this project (schema is applied via `prisma db push`),
# so push the schema before starting rather than `prisma migrate deploy`.
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main"]
