FROM node:22-alpine3.19
WORKDIR /app
COPY package.json /app
RUN npm install
COPY . .
CMD ["npm", "start"]
