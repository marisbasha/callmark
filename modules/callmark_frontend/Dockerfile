FROM node:20

WORKDIR /app
COPY package*.json ./

RUN npm install

COPY . .

# Set default environment
ENV NODE_ENV=production

CMD ["sh", "-c", "if [ \"$NODE_ENV\" = \"development\" ]; then npm run dev; else npm run build && npx serve -s dist -l 5050; fi"]