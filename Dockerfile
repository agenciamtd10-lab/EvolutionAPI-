FROM node:24-alpine AS builder

RUN apk update && \
    apk add git ffmpeg wget curl bash

LABEL version="2.3.7" description="Api to control whatsapp features through http requests."
LABEL maintainer="Jean Lima" git="https://github.com/jeandgardany"
LABEL contact="jeandgardany@hotmail.com"

WORKDIR /evolution

COPY ./package.json ./package-lock.json ./tsconfig.json ./

RUN npm ci --silent --ignore-scripts

COPY ./src ./src
COPY ./public ./public
COPY ./prisma ./prisma
COPY ./manager ./manager
COPY ./.env.example ./.env
COPY ./runWithProvider.js ./
COPY ./tsup.config.ts ./

COPY ./Docker ./Docker

RUN chmod +x ./Docker/scripts/* && dos2unix ./Docker/scripts/*

RUN ./Docker/scripts/generate_database.sh

RUN ./node_modules/.bin/tsup

FROM node:24-alpine AS final

RUN apk update && \
    apk add tzdata ffmpeg bash openssl openssl-dev libc6-compat

ENV TZ=America/Fortaleza

WORKDIR /evolution

COPY --from=builder /evolution/package.json ./package.json
COPY --from=builder /evolution/package-lock.json ./package-lock.json

COPY --from=builder /evolution/node_modules ./node_modules
COPY --from=builder /evolution/dist ./dist
COPY --from=builder /evolution/prisma ./prisma
COPY --from=builder /evolution/manager ./manager
COPY --from=builder /evolution/public ./public
COPY --from=builder /evolution/.env ./.env
COPY --from=builder /evolution/Docker ./Docker
COPY --from=builder /evolution/runWithProvider.js ./runWithProvider.js
COPY --from=builder /evolution/tsup.config.ts ./tsup.config.ts

ENV DOCKER_ENV=true

EXPOSE 8080

ENTRYPOINT ["/bin/bash", "-c", ". ./Docker/scripts/deploy_database.sh && npm run start:prod" ]