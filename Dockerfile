FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./

# 1. Instalamos TODAS las dependencias (incluyendo NestJS y TypeScript)
RUN npm install --include=dev

# 2. Instalamos el compilador globalmente para evitar fallos ocultos
RUN npm install -g @nestjs/cli typescript

# 3. Copiamos el código fuente
COPY . .

# 4. Generamos Prisma
RUN npx prisma generate

# 5. Forzamos la compilación nativa
RUN nest build

EXPOSE 3000

# 6. Ejecutamos DIRECTAMENTE el archivo con la extensión .js exacta
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
