FROM node:22-alpine AS builder
WORKDIR /app
# Alpine ships musl + OpenSSL 3.x by default; Prisma's engine detection needs
# openssl explicitly present to pick the right engine binary reliably.
RUN apk add --no-cache openssl
# PDFs use the distro's Chromium (installed in the runner), not Puppeteer's glibc download.
ENV PUPPETEER_SKIP_DOWNLOAD=true
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
# Chromium + fonts for server-side PDFs (business documents). font-noto covers the ₹ sign and
# Indic scripts; ttf-freefont is the fallback for everything else.
RUN apk add --no-cache openssl chromium nss freetype harfbuzz ca-certificates ttf-freefont font-noto
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
