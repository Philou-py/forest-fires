FROM node:22-slim AS builder

WORKDIR /app
ENV PUBLIC_BASE_URL=http://localhost:3000/
COPY package*.json .
RUN npm i
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .
EXPOSE 3000
ENV NODE_ENV=production
CMD [ "node", "build" ]
