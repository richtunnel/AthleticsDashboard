# --- STAGE 1: Dependency Installation and Next.js Build (Builder) ---
# Use a Node base image with Alpine for a smaller initial size.
FROM node:20-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock/pnpm-lock.yaml)
# We copy these first so that the dependency layer can be cached if package files haven't changed.
COPY package*.json ./

# Install dependencies, including devDependencies needed for the build (Next.js, TypeScript, Prisma).
RUN npm install

# Copy the rest of the application source code
COPY . .

# IMPORTANT: Generate the Prisma client. This must happen before the Next.js build.
# This step does NOT require a live database connection; it only needs the schema file.
# The generated client is placed in node_modules/.prisma
RUN npx prisma generate

# Build the Next.js application. 
# Because we are using output: 'standalone' (recommended for Docker), 
# the resulting application is placed in the 'standalone' directory.
RUN npm run build


# --- STAGE 2: Minimal Production Image (Runner) ---
# Use a minimal Node image again for the final production environment.
FROM node:20-alpine AS runner

# Set environment variables for production
ENV NODE_ENV production
# Set a default PORT, though DigitalOcean App Platform will inject its own PORT which takes precedence.
ENV PORT 3000

# Set the working directory to where the standalone server will be located
WORKDIR /app

# The Next.js standalone output copies all necessary files, including production dependencies,
# into the /app/.next/standalone directory.
# Copy the built server, which is the root of the 'standalone' output.
# The final image will only contain the files needed to run the app, drastically reducing size.
COPY --from=builder /app/.next/standalone ./

# Copy the public folder containing static assets
COPY --from=builder /app/public ./public

# If you use the experimental `outputFileTracingIncludes` (recommended for Prisma), 
# you need to copy the generated .prisma directory separately from the Next.js build output.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Expose the port (only informative, DO manages the actual port)
EXPOSE ${PORT}

# The final command to run the application using the standalone server.js file.
# DigitalOcean App Platform will execute this command in the environment with injected secrets.
CMD ["node", "server.js"]
