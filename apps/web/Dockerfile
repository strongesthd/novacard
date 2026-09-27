FROM node:22-alpine AS build
WORKDIR /app
# Next.js inlines NEXT_PUBLIC_* at build time, so the canonical public origin
# used to encode QR codes must be supplied here, not only at runtime.
ARG NEXT_PUBLIC_APP_URL=https://novacard.novatechhp.vn
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
COPY package.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm install
COPY apps/web apps/web
RUN npm run build --workspace=@novacard/web
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node","apps/web/server.js"]
