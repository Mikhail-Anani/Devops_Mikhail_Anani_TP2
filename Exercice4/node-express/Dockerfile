FROM node:18-alpine

WORKDIR /app

# Dépendances d'abord (cache Docker)
COPY package.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]
