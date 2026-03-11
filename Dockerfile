FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./

# 1. Usamos npm install para garantizar que se instalen las herramientas de compilación (TypeScript)
RUN npm install

COPY . .

# 2. Generamos Prisma
RUN npx prisma generate

# 3. Ahora la compilación sí funcionará y creará la carpeta dist/
RUN npm run build

EXPOSE 3000

# 4. Usamos el script nativo de NestJS para producción
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:prod"]
