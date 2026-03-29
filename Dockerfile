# Dockerfile for static hfa-silverstrong healthcare portal
FROM nginx:stable-alpine

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy app
COPY index.html /usr/share/nginx/html/index.html

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
