FROM node:18-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package.json
COPY package.json ./

# Install dependencies with pnpm
RUN pnpm install

# Copy all source code
COPY . .

# Build application
RUN pnpm run build

# Ensure templates directory is copied to dist if it exists in src
RUN if [ -d "src/templates" ] && [ ! -d "dist/templates" ]; then \
    cp -r src/templates dist/templates; \
    fi

# Create the templates directories to avoid copy failures
RUN mkdir -p /app/templates-ready
# Copy templates from root if they exist
RUN if [ -d "/app/templates" ]; then \
    cp -r /app/templates/* /app/templates-ready/ || true; \
    fi
# Copy templates from dist if they exist
RUN if [ -d "/app/dist/templates" ]; then \
    cp -r /app/dist/templates/* /app/templates-ready/ || true; \
    fi

FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package.json from builder stage
COPY --from=builder /app/package.json ./

# Install only production dependencies
RUN pnpm install --prod

# Copy build files
COPY --from=builder /app/dist ./dist

# Copy the prepared templates directory
COPY --from=builder /app/templates-ready ./templates

EXPOSE 8001

CMD ["node", "dist/main"]