FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create volume for database
VOLUME ["/app/data"]

# Environment variables with defaults
ENV PORT=8080 \
    DB_PATH=/app/data/pastes.db \
    AUTH_USER=admin \
    AUTH_PASS=changeme

EXPOSE 8080

CMD ["node", "server.js"]