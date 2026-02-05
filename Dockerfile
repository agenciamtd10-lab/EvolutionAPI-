FROM atendai/evolution-api:latest

ENV NODE_ENV=production
ENV DOCKER_ENV=true
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "run", "start:prod"]
