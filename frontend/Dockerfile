FROM node:18-alpine as builder
ARG VITE_API_URL

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Write Vite env for build and then build
RUN echo "VITE_API_URL=${VITE_API_URL:-http://localhost:8000}" > .env
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY frontend/nginx.conf /etc/nginx/nginx.conf

# Copy built app
COPY --from=builder /app/dist /usr/share/nginx/html

# Generate self-signed certificate for HTTPS
RUN apk add --no-cache openssl \
    && mkdir -p /etc/nginx/ssl \
    && openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/self.key -out /etc/nginx/ssl/self.crt \
        -subj "/C=US/ST=State/L=City/O=Org/OU=Dev/CN=192.168.1.3"

# Create model directory and download YOLOv8n model for WASM mode
RUN mkdir -p /usr/share/nginx/html/models
RUN apk add --no-cache curl && \
        # download yolov5n (used by frontend) and yolov8n as fallback
        curl -L -o /usr/share/nginx/html/models/yolov5n.onnx \
            "https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov5n.onnx" || echo "yolov5n download failed" && \
        curl -L -o /usr/share/nginx/html/models/yolov8n.onnx \
            "https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.onnx" || echo "yolov8n download failed"

EXPOSE 80

EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]