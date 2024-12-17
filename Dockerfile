# 1. Usa a imagem oficial do Node.js como base
FROM node:20

# 2. Define o diretório de trabalho no container
WORKDIR /usr/src/app

# 3. Copia o package.json e package-lock.json
COPY package*.json ./

# 4. Instala as dependências (incluindo dotenv)
RUN npm install

# 5. Copia todos os arquivos da aplicação para o container
COPY . .

# 6. Copia o arquivo .env
COPY .env .env

# 7. Expõe as portas necessárias
EXPOSE 3000 8080

# 8. Comando para rodar a aplicação
CMD ["node", "server.js"]
