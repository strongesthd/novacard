FROM node:22-alpine AS build
WORKDIR /app
COPY package.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm install
COPY apps/api apps/api
RUN npm run build --workspace=@novacard/api
FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/apps/api/dist ./dist
EXPOSE 4000
CMD ["node","dist/main.js"]
