FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

RUN npm install -g @nestjs/cli

COPY . .

RUN npx prisma generate

# 1. Compilamos el proyecto de TypeScript a JavaScript puro
RUN npm run build

EXPOSE 3000

# 2. Ejecutamos las migraciones y levantamos el archivo compilado (dist/main)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
