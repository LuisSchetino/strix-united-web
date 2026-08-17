FROM node:20-slim
WORKDIR /app
COPY package.json ./
COPY ea-client.js server.js ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
