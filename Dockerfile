FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

RUN npm install -g @nestjs/cli

COPY . .

RUN rm -rf dist

RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:dev"]
