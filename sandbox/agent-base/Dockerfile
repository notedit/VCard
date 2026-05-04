FROM node:20-alpine
WORKDIR /app
COPY package.json /app/
RUN npm i
COPY . /app
EXPOSE 7000
CMD ["npm", "run", "start"]
