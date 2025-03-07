# To build the image without docker-compose: sudo docker build --platform=linux/amd64,linux/arm64 -t philoupy/forest-fires .

FROM node:22-slim AS builder
RUN apt-get update
# These packages are required by the 'node-canvas' library
RUN apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev

WORKDIR /app
COPY package*.json .
RUN npm i

COPY . .
ENV PUBLIC_BASE_URL=https://forest-fires.exploranotes.fr/
RUN npm run build
RUN npm prune --production

EXPOSE 3000
ENV NODE_ENV=production
CMD [ "node", "build" ]

